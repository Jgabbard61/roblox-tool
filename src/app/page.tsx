'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Papa from 'papaparse';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import DeepContext from './components/DeepContext';
import SmartSuggest from './components/SmartSuggest';
import ForensicMode from './components/ForensicMode';
import { SearchMode } from './components/SearchModeSelector';
import DisplayNameResults from './components/DisplayNameResults';
import NoResultsModal from './components/NoResultsModal';
import HeroHeader from './components/HeroHeader';
import PartnerFooter from './components/PartnerFooter';
import ModernSearchCard from './components/ModernSearchCard';
import { useCooldown } from './hooks/useCooldown';
import { getTopSuggestions } from './lib/ranking';
import { useCreditBalance } from './context/CreditContext';

function normalizeInput(rawInput: string): { type: 'username' | 'displayName' | 'userId' | 'url' | 'invalid'; value: string; userId?: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) return { type: 'invalid', value: '' };

  const urlMatch = trimmed.match(/roblox\.com\/users\/(\d+)\/profile/i);
  if (urlMatch) return { type: 'url', value: trimmed, userId: urlMatch[1] };

  if (/^\d+$/.test(trimmed)) return { type: 'userId', value: trimmed };

  const usernameMatch = trimmed.match(/^@?([a-zA-Z0-9_]+)$/);
  if (usernameMatch) return { type: 'username', value: usernameMatch[1] };

  return { type: 'displayName', value: trimmed };
}

interface UserResult {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  created?: string;
  description?: string;
}

type RobloxResponse = UserResult | { error: string };

interface ScoredCandidate {
  user: UserResult;
  confidence: number;
  signals: {
    nameSimilarity: number;
    accountSignals: number;
    keywordHits: number;
    groupOverlap: number;
    profileCompleteness: number;
  };
  breakdown: string[];
}

interface BatchOutput {
  input: string;
  status: string;
  details?: string;
  suggestions?: ScoredCandidate[];
  avatar?: number;
}

function VerifierTool() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshBalance } = useCreditBalance();

  const [input, setInput] = useState<string>('');
  const [result, setResult] = useState<ReactNode | null>(null);
  const [includeBanned, setIncludeBanned] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [batchResults, setBatchResults] = useState<BatchOutput[]>([]);
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  const [forensicMode, setForensicMode] = useState<boolean>(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<Record<string, unknown> | null>(null);
  const [currentQuery, setCurrentQuery] = useState<{ input: string; mode: 'username' | 'userId' | 'displayName' | 'url' } | null>(null);
  const [showDeepContext, setShowDeepContext] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [scoredCandidates, setScoredCandidates] = useState<ScoredCandidate[]>([]);
  const [originalDisplayNameQuery, setOriginalDisplayNameQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<SearchMode>('exact');
  const [displayNameUsers, setDisplayNameUsers] = useState<UserResult[]>([]);
  const [showNoResultsModal, setShowNoResultsModal] = useState<boolean>(false);
  const [noResultsQuery, setNoResultsQuery] = useState<string>('');
  // Customer logo functionality - can be re-enabled if needed
  // const [customerLogo, setCustomerLogo] = useState<string | null>(null);

  // Cooldown hooks for Smart and Display Name modes
  const smartCooldown = useCooldown({ key: 'smart_search', durationSeconds: 30 });
  const displayNameCooldown = useCooldown({ key: 'display_name_search', durationSeconds: 30 });

  // Removed authentication redirect - tool is now public!
  // Admin can still log in to access admin dashboard
  // useEffect(() => {
  //   if (status === 'unauthenticated') {
  //     router.push('/auth/signin');
  //   }
  // }, [status, router]);

  // Customer logo fetch - commented out as part of UI redesign
  // Can be re-enabled if needed for customer-specific branding
  // useEffect(() => {
  //   const fetchCustomerLogo = async () => {
  //     if (session?.user?.customerId) {
  //       try {
  //         const res = await fetch(`/api/customer-logo/${session.user.customerId}`);
  //         if (res.ok) {
  //           const data = await res.json();
  //           setCustomerLogo(data.logoUrl);
  //         }
  //       } catch (error) {
  //         console.error('Failed to fetch customer logo:', error);
  //       }
  //     }
  //   };
  //   if (session) {
  //     fetchCustomerLogo();
  //   }
  // }, [session]);

  const handleSubmit = async (e: React.FormEvent, batchInputs: string[] = []) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setBatchResults([]);
    setScoredCandidates([]);
    setOriginalDisplayNameQuery('');
    setDisplayNameUsers([]);
    
    // Use local variable to avoid React state update race conditions
    const isCurrentlyBatchMode = batchInputs.length > 0;
    setIsBatchMode(isCurrentlyBatchMode);

    const inputs = batchInputs.length > 0 ? batchInputs : [input];
    const outputs: BatchOutput[] = [];

    for (const singleInput of inputs) {
      const parsed = normalizeInput(singleInput);
      if (parsed.type === 'invalid') {
        outputs.push({ input: singleInput, status: 'Invalid', details: 'Invalid input' });
        continue;
      }

      if (forensicMode && !isCurrentlyBatchMode) {
        setCurrentQuery({ input: parsed.value, mode: parsed.type });
      }

      try {
        let response;
        let user: RobloxResponse | null = null;

        // Handle different search modes
        if (searchMode === 'exact' && parsed.type === 'username') {
          // Exact Match Mode - direct username lookup, no cooldown
          try {
            response = await fetch('/api/roblox', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: parsed.value, includeBanned }),
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));

              // Handle rate limiting (429) - IP-based: 25 searches per hour
              if (response.status === 429) {
                throw new Error(errorData.message || 'Rate limit exceeded. Please wait before searching again.');
              }
              // Handle service unavailable (503)
              else if (response.status === 503) {
                throw new Error('Service temporarily unavailable. Please try again in a moment.');
              }
              // Generic error
              else {
                throw new Error(errorData.message || 'Roblox API error');
              }
            }
            
            const data = await response.json();
            user = data.data?.[0] || null;
          } catch (exactSearchError: unknown) {
            console.error('Exact Match search error:', exactSearchError);
            const errorMessage = exactSearchError instanceof Error ? exactSearchError.message : 'Search failed';
            
            if (!isCurrentlyBatchMode) {
              setResult(
                <div className="bg-red-100 p-4 rounded-md">
                  <h2 className="text-xl font-bold text-red-800">Search Error</h2>
                  <p className="mb-2">{errorMessage}</p>
                  <p className="text-sm text-red-700">Try using <strong>Exact Match</strong> mode if you know the exact username.</p>
                </div>
              );
            }
            
            outputs.push({
              input: singleInput,
              status: 'Error',
              details: errorMessage,
            });
            continue;
          }
        } else if (searchMode === 'smart' && (parsed.type === 'username' || parsed.type === 'displayName')) {
          // Smart Match Mode - fuzzy search with AI ranking
          try {
            response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10&searchMode=smart`);
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              
              // Handle rate limiting specifically
              if (response.status === 429) {
                throw new Error('Rate limited. Please wait before searching again.');
              } else if (response.status === 503) {
                throw new Error('Service temporarily unavailable. Please try again in a moment.');
              } else {
                throw new Error(errorData.message || 'Failed to search. Please try again.');
              }
            }
            
            const searchData = await response.json();
            
            // ALWAYS trigger cooldown for smart searches (prevents abuse)
            if (!isCurrentlyBatchMode) {
              smartCooldown.startCooldown();
            }
            
            // If duplicate search, refresh balance to show no credit was deducted
            if (searchData.isDuplicate) {
              console.log('Duplicate search detected - no credit charged (results from cache)');
              if (session) refreshBalance();
            }
            
            const candidates = getTopSuggestions(parsed.value, searchData.data || [], 10);
            
            if (!isCurrentlyBatchMode) {
              setScoredCandidates(candidates);
              setOriginalDisplayNameQuery(parsed.value);
            }
            
            outputs.push({
              input: singleInput,
              status: candidates.length > 0 ? 'Suggestions' : 'Not Found',
              suggestions: candidates,
              details: candidates.length === 0 ? 'No similar matches found' : undefined,
            });
          } catch (smartSearchError: unknown) {
            console.error('Smart Search error:', smartSearchError);
            const errorMessage = smartSearchError instanceof Error ? smartSearchError.message : 'Search failed';
            
            if (!isCurrentlyBatchMode) {
              setScoredCandidates([]);
              setResult(
                <div className="bg-red-100 p-4 rounded-md">
                  <h2 className="text-xl font-bold text-red-800">Search Error</h2>
                  <p className="mb-2">{errorMessage}</p>
                  <p className="text-sm text-red-700">Try using <strong>Exact Match</strong> mode if you know the exact username.</p>
                </div>
              );
            }
            
            outputs.push({
              input: singleInput,
              status: 'Error',
              details: errorMessage,
            });
          }
          continue;
        } else if (searchMode === 'displayName') {
          // Display Name Mode - fuzzy search showing all matching results
          try {
            response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=20&searchMode=displayName`);
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              
              // Handle rate limiting specifically
              if (response.status === 429) {
                throw new Error('Rate limited. Please wait before searching again.');
              } else if (response.status === 503) {
                throw new Error('Service temporarily unavailable. Please try again in a moment.');
              } else {
                throw new Error(errorData.message || 'Failed to search. Please try again.');
              }
            }
            
            const searchData = await response.json();
            
            // ALWAYS trigger cooldown for display name searches (prevents abuse)
            if (!isCurrentlyBatchMode) {
              displayNameCooldown.startCooldown();
            }
            
            // If duplicate search, refresh balance to show no credit was deducted
            if (searchData.isDuplicate) {
              console.log('Duplicate search detected - no credit charged (results from cache)');
              if (session) refreshBalance();
            }
            
            const users = searchData.data || [];
            
            if (!isCurrentlyBatchMode) {
              setDisplayNameUsers(users);
              setOriginalDisplayNameQuery(parsed.value);
            }
            
            outputs.push({
              input: singleInput,
              status: users.length > 0 ? 'Found' : 'Not Found',
              details: users.length > 0 ? `Found ${users.length} user(s) matching "${parsed.value}"` : 'No matches found',
            });
          } catch (displayNameError: unknown) {
            console.error('Display Name search error:', displayNameError);
            const errorMessage = displayNameError instanceof Error ? displayNameError.message : 'Search failed';
            
            if (!isCurrentlyBatchMode) {
              setDisplayNameUsers([]);
              setResult(
                <div className="bg-red-100 p-4 rounded-md">
                  <h2 className="text-xl font-bold text-red-800">Search Error</h2>
                  <p className="mb-2">{errorMessage}</p>
                  <p className="text-sm text-red-700">Try using <strong>Exact Match</strong> mode if you know the exact username.</p>
                </div>
              );
            }
            
            outputs.push({
              input: singleInput,
              status: 'Error',
              details: errorMessage,
            });
          }
          continue;
        } else if (parsed.type === 'userId' || parsed.type === 'url') {
          const id = parsed.userId || parsed.value;
          response = await fetch(`/api/roblox?userId=${id}`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Handle insufficient credits (402)
            if (response.status === 402) {
              throw new Error(errorData.message || 'Insufficient credits. Please purchase more credits to continue.');
            }
            // Handle rate limiting (429)
            else if (response.status === 429) {
              throw new Error('Rate limited. Please wait before searching again.');
            }
            // Handle service unavailable (503)
            else if (response.status === 503) {
              throw new Error('Service temporarily unavailable. Please try again in a moment.');
            }
            // Generic error
            else {
              throw new Error(errorData.message || 'Roblox API error');
            }
          }
          
          user = await response.json();
        } else if (parsed.type === 'username') {
          // Fallback for username in non-exact mode
          response = await fetch('/api/roblox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: parsed.value, includeBanned }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Handle insufficient credits (402)
            if (response.status === 402) {
              throw new Error(errorData.message || 'Insufficient credits. Please purchase more credits to continue.');
            }
            // Handle rate limiting (429)
            else if (response.status === 429) {
              throw new Error('Rate limited. Please wait before searching again.');
            }
            // Handle service unavailable (503)
            else if (response.status === 503) {
              throw new Error('Service temporarily unavailable. Please try again in a moment.');
            }
            // Generic error
            else {
              throw new Error(errorData.message || 'Roblox API error');
            }
          }
          
          const data = await response.json();
          user = data.data?.[0] || null;
        } else {
          // Fallback to search for other cases
          response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10&searchMode=smart`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Handle insufficient credits (402)
            if (response.status === 402) {
              throw new Error(errorData.message || 'Insufficient credits. Please purchase more credits to continue.');
            }
            // Handle rate limiting (429)
            else if (response.status === 429) {
              throw new Error('Rate limited. Please wait before searching again.');
            }
            // Handle service unavailable (503)
            else if (response.status === 503) {
              throw new Error('Service temporarily unavailable. Please try again in a moment.');
            }
            // Generic error
            else {
              throw new Error(errorData.message || 'Roblox API error');
            }
          }
          
          const searchData = await response.json();
          const candidates = getTopSuggestions(parsed.value, searchData.data || [], 10);
          
          if (!isCurrentlyBatchMode) {
            setScoredCandidates(candidates);
            setOriginalDisplayNameQuery(parsed.value);
          }
          
          outputs.push({
            input: singleInput,
            status: candidates.length > 0 ? 'Suggestions' : 'Not Found',
            suggestions: candidates,
            details: candidates.length === 0 ? 'No matches' : undefined,
          });
          continue;
        }

        if (user && !('error' in user)) {
          if (forensicMode && !isCurrentlyBatchMode) {
            try {
              const profileResponse = await fetch(`/api/profile/${user.id}`);
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                setCurrentSnapshot(profileData);
              }
            } catch (error) {
              console.error('Failed to fetch profile for forensic mode:', error);
            }
          }

          outputs.push({
            input: singleInput,
            status: 'Verified',
            details: `Username: ${user.name}, Display Name: ${user.displayName}, ID: ${user.id}, Verified Badge: ${user.hasVerifiedBadge ? 'Yes' : 'No'}`,
            avatar: user.id,
          });
        } else {
          // If no user found with exact match
          // In exact mode, don't automatically perform smart search - let user decide
          if (searchMode === 'exact') {
            // Show the modal to let user decide if they want to try smart search
            if (!isCurrentlyBatchMode) {
              setNoResultsQuery(parsed.value);
              setShowNoResultsModal(true);
              setScoredCandidates([]);
            }
            
            outputs.push({
              input: singleInput,
              status: 'Not Found',
              details: 'No exact match found',
            });
          } else {
            // For non-exact modes, perform smart search fallback
            response = await fetch(`/api/search?keyword=${encodeURIComponent(parsed.value)}&limit=10&searchMode=smart`);
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));

              // Handle rate limiting (429) - IP-based: 25 searches per hour
              if (response.status === 429) {
                throw new Error(errorData.message || 'Rate limit exceeded. Please wait before searching again.');
              }
              // Handle service unavailable (503)
              else if (response.status === 503) {
                throw new Error('Service temporarily unavailable. Please try again in a moment.');
              }
              // Generic error
              else {
                throw new Error(errorData.message || 'Roblox API error');
              }
            }
            
            const searchData = await response.json();
            const candidates = getTopSuggestions(parsed.value, searchData.data || [], 10);
            
            if (!isCurrentlyBatchMode) {
              setScoredCandidates(candidates);
            }
            
            outputs.push({
              input: singleInput,
              status: candidates.length > 0 ? 'Suggestions' : 'Not Found',
              suggestions: candidates,
              details: candidates.length === 0 ? 'No matches' : undefined,
            });
          }
        }
      } catch (error: unknown) {
        console.error('API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Could not connect to Roblox API. Try again.';
        
        // Display error UI for single searches (non-batch mode)
        if (!isCurrentlyBatchMode) {
          setResult(
            <div className="bg-red-100 p-4 rounded-md">
              <h2 className="text-xl font-bold text-red-800">Search Error</h2>
              <p className="mb-2">{errorMessage}</p>
              <p className="text-sm text-red-700">
                {errorMessage.includes('Insufficient credits') 
                  ? 'Please purchase more credits to continue.'
                  : 'Try using <strong>Exact Match</strong> mode if you know the exact username.'}
              </p>
            </div>
          );
        }
        
        outputs.push({ input: singleInput, status: 'Error', details: errorMessage });
      }
    }

    setBatchResults(outputs);

    if (!isCurrentlyBatchMode && outputs.length === 1) {
      const out = outputs[0];
      
      if (out.status === 'Verified') {
        setScoredCandidates([]);
        setInput('');
        
        setResult(
          <div className="bg-green-100 p-4 rounded-md">
            <h2 className="text-xl font-bold text-green-800 mb-2">✓ Verified!</h2>
            <p className="mb-3">{out.details}</p>
            {out.avatar && (
              <Image
                src={`/api/thumbnail?userId=${out.avatar}`}
                alt="Avatar"
                width={64}
                height={64}
                className="mt-2 rounded-full"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI0U1RTdFQiIvPgogIDxjaXJjbGUgY3g9IjMyIiBjeT0iMjQiIHI9IjEwIiBmaWxsPSIjOUNBM0I5Ii8+CiAgPHBhdGggZD0iTTE2IDUyQzE2IDQzLjE2MzQgMjMuMTYzNCAzNiAzMiAzNkM0MC44MzY2IDM2IDQ4IDQzLjE2MzQgNDggNTJWNjRIMTZWNTJaIiBmaWxsPSIjOUNBM0I5Ii8+Cjwvc3ZnPgo=';
                }}
              />
            )}
            <button
              onClick={() => {
                setSelectedUserId(out.avatar?.toString() || null);
                setShowDeepContext(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              🔍 View Full Profile
            </button>
          </div>
        );
      } else if (out.status === 'Not Found') {
        setScoredCandidates([]);
        
        // Show modal for Exact Search mode only
        if (searchMode === 'exact') {
          setNoResultsQuery(input);
          setShowNoResultsModal(true);
        }
        
        setResult(
          <div className="bg-red-100 p-4 rounded-md">
            <h2 className="text-xl font-bold text-red-800">{out.status}</h2>
            <p>{out.details}</p>
          </div>
        );
      }
    }

    // Auto-refresh credit balance after search completes (only for authenticated users)
    if (session) refreshBalance();

    setLoading(false);
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse<string[]>(file, {
        complete: (results: Papa.ParseResult<string[]>) => {
          const batchInputs = results.data.flat().filter(Boolean);
          handleSubmit({ preventDefault: () => {} } as React.FormEvent, batchInputs);
        },
        header: false,
      });
    }
  };

  const exportToCSV = (data: BatchOutput[]) => {
    const csvData = data.map((out) => ({
      Input: out.input,
      Status: out.status,
      Details: out.details || (out.suggestions ? `Found ${out.suggestions.length} suggestions` : ''),
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'roblox_verifier_batch_results.csv';
    link.click();
  };

  const handleSelectCandidate = (username: string) => {
    setInput(username);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectCandidate = (userId: number) => {
    setSelectedUserId(userId.toString());
    setShowDeepContext(true);
  };

  const handleTrySmartSearch = async () => {
    setShowNoResultsModal(false);
    setSearchMode('smart');
    setInput(noResultsQuery);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Trigger the smart search automatically with the stored query
    // Use setTimeout to allow state updates to complete first
    setTimeout(async () => {
      try {
        setLoading(true);
        setResult(null);
        setScoredCandidates([]);
        
        // Perform smart search
        const response = await fetch(`/api/search?keyword=${encodeURIComponent(noResultsQuery)}&limit=10&searchMode=smart`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 402) {
            throw new Error(errorData.message || 'Insufficient credits. Please purchase more credits to continue.');
          } else if (response.status === 429) {
            throw new Error('Rate limited. Please wait before searching again.');
          } else if (response.status === 503) {
            throw new Error('Service temporarily unavailable. Please try again in a moment.');
          } else {
            throw new Error(errorData.message || 'Failed to search. Please try again.');
          }
        }
        
        const searchData = await response.json();
        const candidates = getTopSuggestions(noResultsQuery, searchData.data || [], 10);
        
        setScoredCandidates(candidates);
        setOriginalDisplayNameQuery(noResultsQuery);
        
        if (candidates.length === 0) {
          setResult(
            <div className="bg-red-100 p-4 rounded-md">
              <h2 className="text-xl font-bold text-red-800">No Results Found</h2>
              <p>No similar matches found for &quot;{noResultsQuery}&quot;</p>
            </div>
          );
        }
      } catch (error: unknown) {
        console.error('Smart Search error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        
        setResult(
          <div className="bg-red-100 p-4 rounded-md">
            <h2 className="text-xl font-bold text-red-800">Search Error</h2>
            <p className="mb-2">{errorMessage}</p>
          </div>
        );
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-xl font-medium text-gray-700">Loading...</div>
      </div>
    );
  }

  // Tool is now public - no session check required
  // Both authenticated and unauthenticated users can use the tool

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Hero Header */}
      <HeroHeader />

      {/* Main Content */}
      <main className="flex-1 -mt-8 relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {/* Forensic Mode Toggle */}
          {!isBatchMode && (
            <div className="mb-6">
              <ForensicMode
                isEnabled={forensicMode}
                onToggle={setForensicMode}
                currentSnapshot={currentSnapshot}
                query={currentQuery}
              />
            </div>
          )}

          {/* Modern Search Card */}
          <ModernSearchCard
            searchMode={searchMode}
            onModeChange={setSearchMode}
            input={input}
            onInputChange={setInput}
            includeBanned={includeBanned}
            onIncludeBannedChange={setIncludeBanned}
            onSubmit={(e) => handleSubmit(e)}
            loading={loading}
            smartCooldown={smartCooldown}
            displayNameCooldown={displayNameCooldown}
            onFileUpload={handleBatchUpload}
          />

          {/* Results Section */}
          <div className="mt-8 space-y-6">
            {/* Loading indicator */}
            {loading && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">Searching Roblox database...</p>
              </div>
            )}

            {/* Single result */}
            {result && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Search Result
                </h3>
                <div className="bg-gray-50 rounded-xl p-4">{result}</div>
              </div>
            )}

            {/* Display Name Results */}
            {!isBatchMode && searchMode === 'displayName' && displayNameUsers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <DisplayNameResults
                  users={displayNameUsers}
                  query={originalDisplayNameQuery}
                  onSelect={handleSelectCandidate}
                  onInspect={handleInspectCandidate}
                  loading={loading}
                />
              </div>
            )}

            {/* Smart Suggest Results */}
            {!isBatchMode && searchMode === 'smart' && scoredCandidates.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <SmartSuggest
                  candidates={scoredCandidates}
                  query={originalDisplayNameQuery}
                  onSelect={handleSelectCandidate}
                  onInspect={handleInspectCandidate}
                  loading={loading}
                />
              </div>
            )}

            {/* Batch Results */}
            {isBatchMode && batchResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Batch Results</h3>
                  <button
                    onClick={() => exportToCSV(batchResults)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Input</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((out, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-3 px-4 text-sm text-gray-800">{out.input}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              out.status === 'Found' ? 'bg-green-100 text-green-700' :
                              out.status === 'Not Found' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {out.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{out.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Auth buttons */}
            <div className="flex justify-center gap-4">
              {session ? (
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  className="px-6 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => router.push('/auth/signin')}
                  className="px-6 py-2 text-sm text-purple-600 hover:text-purple-700 font-medium transition"
                >
                  Admin Login
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Partner Footer */}
      <PartnerFooter />

      {/* Modals */}
      {showDeepContext && selectedUserId && (
        <DeepContext
          userId={selectedUserId}
          onClose={() => {
            setShowDeepContext(false);
            setSelectedUserId(null);
          }}
        />
      )}

      <NoResultsModal
        isOpen={showNoResultsModal}
        onClose={() => setShowNoResultsModal(false)}
        onTrySmartSearch={handleTrySmartSearch}
        searchQuery={noResultsQuery}
      />
    </div>
  );
}

export default VerifierTool;