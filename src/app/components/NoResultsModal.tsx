'use client';

interface NoResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrySmartSearch: () => void;
  searchQuery: string;
}

export default function NoResultsModal({
  isOpen,
  onClose,
  onTrySmartSearch,
  searchQuery,
}: NoResultsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all animate-fade-in">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <span className="text-4xl">❌</span>
          </div>
          
          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            No Exact Match Found
          </h3>
          
          {/* Message */}
          <p className="text-gray-600 mb-4">
            We couldn&apos;t find an exact match for <span className="font-semibold text-blue-600">&quot;{searchQuery}&quot;</span>
          </p>
          
          {/* Suggestion */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              💡 <span className="font-semibold">Tip:</span> Try using <span className="font-bold text-purple-600">Smart Search</span> to find similar usernames!
            </p>
            <p className="text-xs text-gray-500">
              Smart Search uses fuzzy matching to find usernames that are close to what you typed.
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Close
            </button>
            <button
              onClick={onTrySmartSearch}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition font-medium shadow-lg"
            >
              🧠 Try Smart Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
