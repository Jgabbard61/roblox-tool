'use client';

import { useState } from 'react';
import { SearchMode } from './SearchModeSelector';

interface ModernSearchCardProps {
  searchMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  input: string;
  onInputChange: (value: string) => void;
  includeBanned: boolean;
  onIncludeBannedChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  smartCooldown: { isOnCooldown: boolean; remainingSeconds: number };
  displayNameCooldown: { isOnCooldown: boolean; remainingSeconds: number };
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ModernSearchCard({
  searchMode,
  onModeChange,
  input,
  onInputChange,
  includeBanned,
  onIncludeBannedChange,
  onSubmit,
  loading,
  smartCooldown,
  displayNameCooldown,
  onFileUpload,
}: ModernSearchCardProps) {
  const [showBatchUpload, setShowBatchUpload] = useState(false);

  const modes = [
    {
      id: 'exact' as SearchMode,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Exact Match',
      description: 'Find exact username matches',
      gradient: 'from-emerald-500 to-teal-500',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      id: 'smart' as SearchMode,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      label: 'Smart Match',
      description: 'AI-powered fuzzy search',
      gradient: 'from-purple-500 to-indigo-500',
      bgLight: 'bg-purple-50',
      textColor: 'text-purple-600',
      cooldown: smartCooldown,
    },
    {
      id: 'displayName' as SearchMode,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      label: 'Display Name',
      description: 'Coming soon',
      gradient: 'from-orange-500 to-pink-500',
      bgLight: 'bg-orange-50',
      textColor: 'text-orange-600',
      comingSoon: true,
    },
  ];

  const getPlaceholder = () => {
    switch (searchMode) {
      case 'exact':
        return 'Enter username, user ID, or Roblox profile URL...';
      case 'smart':
        return 'Enter a username for AI-powered matching...';
      case 'displayName':
        return 'Enter display name to search...';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Searching...';
    switch (searchMode) {
      case 'exact':
        return 'Search Exact Match';
      case 'smart':
        return 'Smart Search';
      case 'displayName':
        return 'Search Display Names';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Search modes */}
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Search Mode</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {modes.map((mode) => {
            const isDisabled = mode.cooldown?.isOnCooldown || mode.comingSoon;
            const isSelected = searchMode === mode.id && !mode.comingSoon;

            return (
              <button
                key={mode.id}
                onClick={() => !isDisabled && onModeChange(mode.id)}
                disabled={isDisabled}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-300
                  ${isSelected
                    ? `bg-gradient-to-br ${mode.gradient} text-white border-transparent shadow-lg transform scale-[1.02]`
                    : `${mode.bgLight} ${mode.textColor} border-transparent hover:border-gray-200 hover:shadow-md`
                  }
                  ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                    {mode.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{mode.label}</div>
                    <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                      {mode.description}
                    </div>
                  </div>
                </div>

                {mode.comingSoon && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white rounded-full">
                      Soon
                    </span>
                  </div>
                )}

                {mode.cooldown?.isOnCooldown && !mode.comingSoon && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Cooldown</span>
                      <span>{mode.cooldown.remainingSeconds}s</span>
                    </div>
                    <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-1000"
                        style={{ width: `${((30 - mode.cooldown.remainingSeconds) / 30) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search input */}
      <form onSubmit={onSubmit} className="p-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
          />
        </div>

        {/* Options row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={includeBanned}
              onChange={(e) => onIncludeBannedChange(e.target.checked)}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
            />
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition">
              Include banned/unavailable accounts
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowBatchUpload(!showBatchUpload)}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Batch Upload CSV
          </button>
        </div>

        {/* Batch upload section */}
        {showBatchUpload && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <input
              type="file"
              accept=".csv"
              onChange={onFileUpload}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-2">
              Upload a CSV file with one column of usernames, display names, or URLs. No headers needed.
            </p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || (searchMode === 'smart' && smartCooldown.isOnCooldown) || (searchMode === 'displayName' && displayNameCooldown.isOnCooldown)}
          className="w-full mt-6 py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {getButtonText()}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
