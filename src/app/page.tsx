'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Papa from 'papaparse';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import DeepContext from './components/DeepContext';
import SmartSuggest from './components/SmartSuggest';
import ForensicMode from './components/ForensicMode';
import SearchModeSelector, { SearchMode } from './components/SearchModeSelector';
import DisplayNameResults from './components/DisplayNameResults';
import NoResultsModal from './components/NoResultsModal';
import CreditHeader from './components/CreditHeader';
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
  const [customerLogo, setCustomerLogo] = useState<string | null>(null);

  // Cooldown hooks for Smart and Display Name modes
  const smartCooldown = useCooldown({ key: 'smart_search', durationSeconds: 30 });
  const displayNameCooldown = useCooldown({ key: 'display_name_search', durationSeconds: 30 });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch customer logo
  useEffect(() => {
    const fetchCustomerLogo = async () => {
      if (session?.user?.customerId) {
        try {
          const res = await fetch(`/api/customer-logo/${session.user.customerId}`);
          if (res.ok) {
            const data = await res.json();
            setCustomerLogo(data.logoUrl);
          }
        } catch (error) {
          console.error('Failed to fetch customer logo:', error);
        }
      }
    };

    if (session) {
      fetchCustomerLogo();
    }
  }, [session]);

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
            
            // Only trigger cooldown if this was NOT a duplicate/cached search
            if (!isCurrentlyBatchMode && !searchData.isDuplicate) {
              smartCooldown.startCooldown();
            }
            
            // If duplicate search, refresh balance to show no credit was deducted
            if (searchData.isDuplicate) {
              console.log('Duplicate search detected - no credit charged');
              refreshBalance();
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
            
            // Only trigger cooldown if this was NOT a duplicate/cached search
            if (!isCurrentlyBatchMode && !searchData.isDuplicate) {
              displayNameCooldown.startCooldown();
            }
            
            // If duplicate search, refresh balance to show no credit was deducted
            if (searchData.isDuplicate) {
              console.log('Duplicate search detected - no credit charged');
              refreshBalance();
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

    // Auto-refresh credit balance after search completes
    refreshBalance();
    
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
    return <div>Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-4xl">
        {/* Header Section with Credits and Admin Button */}
        <div className="mb-4 flex justify-between items-center">
          {/* Credit Balance and Buy Credits */}
          <CreditHeader />

          {/* Admin Dashboard Button (for Super Admin only) */}
          {session?.user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium shadow-md flex items-center gap-2"
            >
              <span>🔐</span>
              <span>Admin Dashboard</span>
            </button>
          )}
        </div>

        {!isBatchMode && (
          <ForensicMode
            isEnabled={forensicMode}
            onToggle={setForensicMode}
            currentSnapshot={currentSnapshot}
            query={currentQuery}
          />
        )}

        <div className="rounded-lg bg-white p-8 shadow-xl">
          {/* Customer Logo */}
          {customerLogo && (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={customerLogo}
                alt="Customer Logo"
                className="max-h-16 object-contain"
              />
            </div>
          )}

          <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
            Roblox Verifier Tool
          </h1>

          {!isBatchMode && (
            <SearchModeSelector
              selectedMode={searchMode}
              onModeChange={setSearchMode}
              smartCooldown={smartCooldown}
              displayNameCooldown={displayNameCooldown}
            />
          )}

          <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                searchMode === 'exact'
                  ? 'Enter exact username, user ID, or URL'
                  : searchMode === 'smart'
                  ? 'Enter username for smart matching'
                  : 'Enter display name to search'
              }
              className="w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
            />
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includeBanned}
                onChange={(e) => setIncludeBanned(e.target.checked)}
                className="h-4 w-4 text-blue-500 focus:ring-blue-200"
              />
              <label className="text-gray-700">Include banned/unavailable accounts</label>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-gradient-to-r from-blue-500 to-purple-600 p-3 text-white font-medium hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 transition shadow-lg"
              disabled={loading || (searchMode === 'smart' && smartCooldown.isOnCooldown) || (searchMode === 'displayName' && displayNameCooldown.isOnCooldown)}
            >
              {loading ? 'Searching...' : searchMode === 'exact' ? '🎯 Exact Search' : searchMode === 'smart' ? '🧠 Smart Search' : '🏷️ Search Display Names'}
            </button>
          </form>

          <div className="mt-6">
            <label className="block text-gray-700 mb-2 flex items-center">
              Batch Upload (CSV):
              <span className="relative inline-block ml-2 group">
                <span className="cursor-help bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  i
                </span>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 w-64 z-10">
                  Upload a CSV file with one column of usernames, display names, or URLs. No headers
                  needed.
                </div>
              </span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleBatchUpload}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {loading && (
            <div className="mt-4 text-center text-blue-500 font-medium animate-pulse">
              Processing...
            </div>
          )}

          {result && <div className="mt-6 rounded-md bg-gray-100 p-6 shadow-inner">{result}</div>}

          {!isBatchMode && searchMode === 'displayName' && displayNameUsers.length > 0 && (
            <DisplayNameResults
              users={displayNameUsers}
              query={originalDisplayNameQuery}
              onSelect={handleSelectCandidate}
              onInspect={handleInspectCandidate}
              loading={loading}
            />
          )}

          {!isBatchMode && searchMode === 'smart' && scoredCandidates.length > 0 && (
            <SmartSuggest
              candidates={scoredCandidates}
              query={originalDisplayNameQuery}
              onSelect={handleSelectCandidate}
              onInspect={handleInspectCandidate}
              loading={loading}
            />
          )}

          {isBatchMode && batchResults.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-4">Batch Results</h2>
              <table className="w-full border-collapse border">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-3 text-left border-b">Input</th>
                    <th className="p-3 text-left border-b">Status</th>
                    <th className="p-3 text-left border-b">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((out, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{out.input}</td>
                      <td className="p-3 border-b">{out.status}</td>
                      <td className="p-3 border-b">{out.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() => exportToCSV(batchResults)}
                className="mt-4 rounded-md bg-green-500 p-3 text-white font-medium hover:bg-green-600 transition"
              >
                📥 Export CSV
              </button>
            </div>
          )}

          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-6 w-full rounded-md bg-red-500 p-3 text-white font-medium hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </div>

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
    </main>
  );
}

export default VerifierTool;