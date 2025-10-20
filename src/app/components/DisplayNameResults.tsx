
'use client';

import { useState } from 'react';
import Image from 'next/image';

interface DisplayNameUser {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
  created?: string;
  description?: string;
}

interface DisplayNameResultsProps {
  users: DisplayNameUser[];
  query: string;
  onSelect: (username: string) => void;
  onInspect: (userId: number) => void;
  loading?: boolean;
}

export default function DisplayNameResults({
  users,
  query,
  onSelect,
  onInspect,
  loading = false,
}: DisplayNameResultsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  if (loading) {
    return (
      <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="mt-6 bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">No Results Found</h3>
        <p className="text-gray-600">
          No users found with display name matching &quot;{query}&quot;
        </p>
      </div>
    );
  }

  const toggleExpanded = (userId: number) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const highlightMatch = (text: string, matchType: 'username' | 'displayName') => {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    
    if (matchType === 'displayName' && lowerText.includes(lowerQuery)) {
      return (
        <span>
          {text}{' '}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
            Display Name Match
          </span>
        </span>
      );
    }
    
    if (matchType === 'username' && lowerText.includes(lowerQuery)) {
      return (
        <span>
          {text}{' '}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Username Match
          </span>
        </span>
      );
    }
    
    return <span>{text}</span>;
  };

  return (
    <div className="mt-6 bg-gradient-to-br from-orange-50 to-pink-50 rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          Display Name Results for &quot;{query}&quot;
        </h3>
        <p className="text-gray-600">
          Found {users.length} user{users.length !== 1 ? 's' : ''} • Display names are not unique
        </p>
      </div>

      <div className="space-y-3">
        {users.map((user) => {
          const isExpanded = expandedIds.has(user.id);
          const displayNameMatch = user.displayName.toLowerCase().includes(query.toLowerCase());
          const usernameMatch = user.name.toLowerCase().includes(query.toLowerCase());

          return (
            <div
              key={user.id}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 p-4 border-l-4 border-orange-500"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <Image
                    src={`/api/thumbnail?userId=${user.id}`}
                    alt={`${user.displayName} avatar`}
                    width={80}
                    height={80}
                    className="rounded-lg shadow-md border-2 border-white"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiNFNUU3RUIiLz4KICA8Y2lyY2xlIGN4PSI0MCIgY3k9IjI4IiByPSIxMiIgZmlsbD0iIzlDQTNCOSIvPgogIDxwYXRoIGQ9Ik0yMCA2NEMyMCA1My41MDY2IDI4LjUwNjYgNDUgMzkgNDVINDFDNTEuNDkzNCA0NSA2MCA1My41MDY2IDYwIDY0VjgwSDIwVjY0WiIgZmlsbD0iIzlDQTNCOSIvPgo8L3N2Zz4K';
                    }}
                  />
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-bold text-gray-800">
                      {highlightMatch(user.displayName, 'displayName')}
                    </h4>
                    {user.hasVerifiedBadge && (
                      <span className="text-blue-500 text-sm">✓</span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-2">
                    @{highlightMatch(user.name, 'username')}
                  </p>
                  
                  <p className="text-sm text-gray-500 mb-2">ID: {user.id}</p>

                  {/* Match indicator */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {displayNameMatch && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                        🏷️ Display name matches
                      </span>
                    )}
                    {usernameMatch && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        @ Username matches
                      </span>
                    )}
                  </div>

                  {/* Bio preview - expandable */}
                  {user.description && (
                    <div className="mb-3">
                      <p className={`text-sm text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {user.description}
                      </p>
                      {user.description.length > 100 && (
                        <button
                          onClick={() => toggleExpanded(user.id)}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSelect(user.name)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:from-orange-600 hover:to-pink-700 transition font-medium shadow-md"
                    >
                      ✓ Select & Verify
                    </button>
                    <button
                      onClick={() => onInspect(user.id)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                    >
                      🔍 Inspect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
