'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { RateLimitInfo, formatRetryAfterTime } from '@/app/lib/utils/rate-limit-detector';

export interface RateLimitAlertProps {
  rateLimitInfo: RateLimitInfo;
  onDismiss?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RateLimitAlert({ rateLimitInfo, onDismiss }: RateLimitAlertProps) {
  if (!rateLimitInfo.isRateLimited) {
    return null;
  }

  const retryMessage = rateLimitInfo.retryAfterSeconds
    ? `Please try again in ${formatRetryAfterTime(rateLimitInfo.retryAfterSeconds)}.`
    : 'Please try again later.';

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>Rate Limit Exceeded</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          You&apos;ve made too many requests to the Roblox API. {retryMessage}
        </p>
        {rateLimitInfo.retryAfterDate && (
          <p className="text-xs opacity-80">
            Rate limit will reset at {rateLimitInfo.retryAfterDate.toLocaleTimeString()}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}