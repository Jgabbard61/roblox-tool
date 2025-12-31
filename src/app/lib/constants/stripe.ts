/**
 * Stripe Configuration Constants
 * Centralized configuration for Stripe API settings
 */

// Stripe API version - keep this consistent across all Stripe instances
export const STRIPE_API_VERSION = '2024-11-20.acacia' as const;

// Security: Validate required environment variables
const validateStripeConfig = () => {
  const errors: string[] = [];

  if (!process.env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY environment variable is required');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  if (errors.length > 0) {
    throw new Error(
      `Stripe configuration error:\n${errors.join('\n')}`
    );
  }
};

// Validate on module load for webhooks
export const getWebhookSecret = (): string => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required for webhook verification');
  }
  return secret;
};

export const getStripeSecretKey = (): string => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return key;
};

// Export for convenience
export const STRIPE_CONFIG = {
  apiVersion: STRIPE_API_VERSION,
  validateConfig: validateStripeConfig,
  getWebhookSecret,
  getStripeSecretKey,
};
