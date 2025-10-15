
'use client';

export type SearchMode = 'exact' | 'smart' | 'displayName';

interface SearchModeSelectorProps {
  selectedMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  smartCooldown: { isOnCooldown: boolean; remainingSeconds: number };
  displayNameCooldown: { isOnCooldown: boolean; remainingSeconds: number };
}

export default function SearchModeSelector({
  selectedMode,
  onModeChange,
  smartCooldown,
  displayNameCooldown,
}: SearchModeSelectorProps) {
  const modes: {
    id: SearchMode;
    icon: string;
    label: string;
    tooltip: string;
    gradient: string;
    cooldown?: { isOnCooldown: boolean; remainingSeconds: number };
  }[] = [
    {
      id: 'exact',
      icon: '🎯',
      label: 'Exact Match',
      tooltip: 'Search for exact username matches only. Fast, no cooldown.',
      gradient: 'from-blue-500 to-green-500',
    },
    {
      id: 'smart',
      icon: '🧠',
      label: 'Smart Match',
      tooltip: 'Fuzzy search for similar usernames. Uses AI ranking. 30s cooldown.',
      gradient: 'from-purple-500 to-blue-500',
      cooldown: smartCooldown,
    },
    {
      id: 'displayName',
      icon: '🏷️',
      label: 'Display Name',
      tooltip: 'Search by display name (not username). Returns multiple results. 30s cooldown.',
      gradient: 'from-orange-500 to-pink-500',
      cooldown: displayNameCooldown,
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Search Mode</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {modes.map((mode) => {
          const isDisabled = mode.cooldown?.isOnCooldown || false;
          const isSelected = selectedMode === mode.id;
          
          return (
            <div key={mode.id} className="relative group">
              <button
                onClick={() => !isDisabled && onModeChange(mode.id)}
                disabled={isDisabled}
                className={`
                  w-full p-4 rounded-lg border-2 transition-all duration-200
                  ${isSelected 
                    ? `bg-gradient-to-r ${mode.gradient} text-white border-transparent shadow-lg scale-105` 
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  relative overflow-hidden
                `}
              >
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-3xl">{mode.icon}</span>
                  <span className="font-semibold text-sm">{mode.label}</span>
                  
                  {mode.cooldown?.isOnCooldown && (
                    <div className="w-full mt-2">
                      <div className="text-xs font-medium mb-1">
                        {mode.cooldown.remainingSeconds}s remaining
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                          style={{
                            width: `${((30 - mode.cooldown.remainingSeconds) / 30) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </button>
              
              {/* Tooltip */}
              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-800 text-white text-xs rounded py-2 px-3 w-64 text-center">
                  {mode.tooltip}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="border-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Alternative modes suggestion during cooldown */}
      {(smartCooldown.isOnCooldown || displayNameCooldown.isOnCooldown) && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            💡 <span className="font-medium">Tip:</span> While waiting for cooldown, try using{' '}
            {smartCooldown.isOnCooldown && displayNameCooldown.isOnCooldown ? (
              <strong>Exact Match</strong>
            ) : smartCooldown.isOnCooldown ? (
              <strong>Exact Match or Display Name</strong>
            ) : (
              <strong>Exact Match or Smart Match</strong>
            )}{' '}
            mode!
          </p>
        </div>
      )}
    </div>
  );
}
