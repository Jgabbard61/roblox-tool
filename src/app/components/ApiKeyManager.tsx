'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKey {
  id: number;
  keyPrefix: string;
  name: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  clientName: string;
}

interface ApiKeyManagerProps {
  className?: string;
}

export default function ApiKeyManager({ className = '' }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);
  
  // Form state
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['verify:read', 'credits:read']);
  const [rateLimit, setRateLimit] = useState(1000);

  const availableScopes = [
    { value: 'verify:read', label: 'Verify: Read', description: 'Use verification endpoints' },
    { value: 'credits:read', label: 'Credits: Read', description: 'Check credit balance' },
    { value: 'credits:write', label: 'Credits: Write', description: 'Purchase credits via API' },
    { value: 'usage:read', label: 'Usage: Read', description: 'View usage statistics' },
  ];

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/auth/generate-key');
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.data.apiKeys || []);
      } else {
        console.error('Failed to fetch API keys');
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleGenerateKey = async () => {
    if (!keyName.trim()) {
      alert('Please enter a name for your API key');
      return;
    }

    if (selectedScopes.length === 0) {
      alert('Please select at least one scope');
      return;
    }

    try {
      setGenerating(true);
      const res = await fetch('/api/v1/auth/generate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: keyName,
          scopes: selectedScopes,
          rateLimit: rateLimit,
          clientName: 'Dashboard Application',
          clientDescription: 'Generated from customer dashboard',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewApiKey(data.data.apiKey);
        
        // Refresh the list of API keys
        await fetchApiKeys();
        
        // Reset form
        setKeyName('');
        setSelectedScopes(['verify:read', 'credits:read']);
        setRateLimit(1000);
      } else {
        const errorData = await res.json();
        alert(`Failed to generate API key: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      alert('An error occurred while generating the API key');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId: number, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/auth/generate-key?keyId=${keyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('API key revoked successfully');
        await fetchApiKeys();
      } else {
        const errorData = await res.json();
        alert(`Failed to revoke API key: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      alert('An error occurred while revoking the API key');
    }
  };

  const copyToClipboard = async (text: string, keyId?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      
      if (keyId) {
        setCopiedKeyId(keyId);
        setTimeout(() => setCopiedKeyId(null), 2000);
      } else {
        setCopiedNewKey(true);
        setTimeout(() => setCopiedNewKey(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter(s => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const closeNewKeyModal = () => {
    setNewApiKey(null);
    setShowGenerateForm(false);
  };

  return (
    <div className={`bg-white rounded-lg shadow-xl p-6 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">API Keys</h2>
          <p className="text-gray-600 text-sm mt-1">Manage your API keys for programmatic access</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/dashboard/api-docs"
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:from-green-600 hover:to-teal-700 transition font-medium shadow-md flex items-center gap-2"
          >
            <span>📖</span>
            <span>API Documentation</span>
          </a>
          <button
            onClick={() => setShowGenerateForm(!showGenerateForm)}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition font-medium shadow-md flex items-center gap-2"
          >
            <span>+</span>
            <span>Generate New Key</span>
          </button>
        </div>
      </div>

      {/* New API Key Modal */}
      {newApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">🎉 API Key Generated Successfully!</h3>
              <button
                onClick={closeNewKeyModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 font-semibold">
                    ⚠️ Important: Save your API key now!
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This is the only time you&apos;ll see the full API key. Make sure to copy and store it securely.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your API Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newApiKey}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(newApiKey)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    copiedNewKey
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {copiedNewKey ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeNewKeyModal}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium"
              >
                I&apos;ve Saved My Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Key Form */}
      {showGenerateForm && (
        <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-blue-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Generate New API Key</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Name *
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., Production API Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scopes (Permissions) *
              </label>
              <div className="space-y-2">
                {availableScopes.map((scope) => (
                  <label key={scope.value} className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{scope.label}</div>
                      <div className="text-sm text-gray-600">{scope.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate Limit (requests per hour)
              </label>
              <input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value) || 1000)}
                min="1"
                max="10000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum requests allowed per hour (1-10,000)</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleGenerateKey}
                disabled={generating}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate API Key'}
              </button>
              <button
                onClick={() => setShowGenerateForm(false)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading API keys...</p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No API Keys Yet</h3>
          <p className="text-gray-500 mb-4">Generate your first API key to start using our API</p>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className={`border rounded-lg p-4 ${
                key.isActive ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-gray-800">{key.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      key.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {key.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {key.keyPrefix}••••••••••••
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.keyPrefix, key.id)}
                      className={`text-xs px-2 py-1 rounded transition ${
                        copiedKeyId === key.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {copiedKeyId === key.id ? '✓ Copied' : 'Copy Prefix'}
                    </button>
                  </div>
                </div>
                {key.isActive && (
                  <button
                    onClick={() => handleRevokeKey(key.id, key.name)}
                    className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium text-sm"
                  >
                    Revoke
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Scopes:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {key.scopes.map((scope) => (
                      <span key={scope} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Rate Limit:</span>
                  <span className="ml-2 font-medium text-gray-800">{key.rateLimit} req/hour</span>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>
                  <span className="ml-2 font-medium text-gray-800">{formatDate(key.createdAt)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Last Used:</span>
                  <span className="ml-2 font-medium text-gray-800">{formatDate(key.lastUsedAt)}</span>
                </div>
                {key.expiresAt && (
                  <div>
                    <span className="text-gray-600">Expires:</span>
                    <span className="ml-2 font-medium text-gray-800">{formatDate(key.expiresAt)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Documentation Link */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 mb-1">Need help getting started?</h4>
            <p className="text-sm text-gray-600 mb-2">
              Check out our API documentation for code examples, authentication details, and endpoint references.
            </p>
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              View API Documentation →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
