
// Custom hook for managing cooldown timers with localStorage persistence
import { useState, useEffect, useCallback } from 'react';

interface CooldownState {
  isOnCooldown: boolean;
  remainingSeconds: number;
  startCooldown: () => void;
  resetCooldown: () => void;
}

interface CooldownConfig {
  key: string;
  durationSeconds: number;
}

export function useCooldown({ key, durationSeconds }: CooldownConfig): CooldownState {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isOnCooldown, setIsOnCooldown] = useState(false);

  // Load cooldown state from localStorage on mount
  useEffect(() => {
    const storedEndTime = localStorage.getItem(`cooldown_${key}`);
    if (storedEndTime) {
      const endTime = parseInt(storedEndTime, 10);
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      
      if (remaining > 0) {
        setRemainingSeconds(remaining);
        setIsOnCooldown(true);
      } else {
        localStorage.removeItem(`cooldown_${key}`);
      }
    }
  }, [key]);

  // Update countdown every second
  useEffect(() => {
    if (!isOnCooldown || remainingSeconds <= 0) {
      if (isOnCooldown) {
        setIsOnCooldown(false);
        localStorage.removeItem(`cooldown_${key}`);
      }
      return;
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          setIsOnCooldown(false);
          localStorage.removeItem(`cooldown_${key}`);
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnCooldown, remainingSeconds, key]);

  const startCooldown = useCallback(() => {
    const endTime = Date.now() + durationSeconds * 1000;
    localStorage.setItem(`cooldown_${key}`, endTime.toString());
    setRemainingSeconds(durationSeconds);
    setIsOnCooldown(true);
  }, [key, durationSeconds]);

  const resetCooldown = useCallback(() => {
    localStorage.removeItem(`cooldown_${key}`);
    setRemainingSeconds(0);
    setIsOnCooldown(false);
  }, [key]);

  return {
    isOnCooldown,
    remainingSeconds,
    startCooldown,
    resetCooldown,
  };
}
