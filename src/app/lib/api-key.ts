import crypto from 'crypto';
import { query } from './db';

export interface ApiKeyData {
  id: number;
  api_client_id: number;
  customer_id: number;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  is_active: boolean;
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

/**
 * Generates a secure API key
 * Format: vrl_live_<random_32_chars> or vrl_test_<random_32_chars>
 */
export function generateApiKey(isProduction: boolean = true): string {
  const prefix = isProduction ? 'vrl_live_' : 'vrl_test_';
  const randomBytes = crypto.randomBytes(24);
  const randomString = randomBytes.toString('base64url'); // URL-safe base64
  return `${prefix}${randomString}`;
}

/**
 * Hashes an API key for secure storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Extracts the prefix from an API key for identification
 */
export function getKeyPrefix(apiKey: string): string {
  // Return first 12 characters (e.g., "vrl_live_abc")
  return apiKey.substring(0, 12);
}

/**
 * Creates a new API key for a client
 */
export async function createApiKey(
  apiClientId: number,
  name: string,
  scopes: string[],
  options: {
    rateLimit?: number;
    expiresInDays?: number;
    isProduction?: boolean;
  } = {}
): Promise<{ apiKey: string; keyData: ApiKeyData }> {
  const {
    rateLimit = 1000,
    expiresInDays,
    isProduction = true,
  } = options;

  // Generate API key
  const apiKey = generateApiKey(isProduction);
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = getKeyPrefix(apiKey);

  // Calculate expiration date if specified
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Get customer_id from api_client
  const clientResult = await query(
    'SELECT customer_id FROM api_clients WHERE id = $1',
    [apiClientId]
  );

  if (clientResult.rows.length === 0) {
    throw new Error('API client not found');
  }

  const customerId = clientResult.rows[0].customer_id;

  // Insert API key into database
  const result = await query(
    `INSERT INTO api_keys 
     (api_client_id, key_hash, key_prefix, name, scopes, rate_limit, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, api_client_id, key_prefix, name, scopes, rate_limit, 
               is_active, last_used_at, expires_at, created_at`,
    [apiClientId, keyHash, keyPrefix, name, scopes, rateLimit, expiresAt]
  );

  const keyData = {
    ...result.rows[0],
    customer_id: customerId,
  } as ApiKeyData;

  return {
    apiKey, // Return the plain API key (only time it's visible)
    keyData,
  };
}

/**
 * Validates an API key and returns its data
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyData | null> {
  const keyHash = hashApiKey(apiKey);

  const result = await query(
    `SELECT 
      ak.id,
      ak.api_client_id,
      ac.customer_id,
      ak.key_prefix,
      ak.name,
      ak.scopes,
      ak.rate_limit,
      ak.is_active,
      ak.last_used_at,
      ak.expires_at,
      ak.created_at
     FROM api_keys ak
     JOIN api_clients ac ON ak.api_client_id = ac.id
     WHERE ak.key_hash = $1 AND ak.is_active = true`,
    [keyHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const keyData = result.rows[0] as ApiKeyData;

  // Check if key has expired
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    // Automatically deactivate expired keys
    await query(
      'UPDATE api_keys SET is_active = false WHERE id = $1',
      [keyData.id]
    );
    return null;
  }

  return keyData;
}

/**
 * Revokes (deactivates) an API key
 */
export async function revokeApiKey(apiKeyId: number): Promise<void> {
  await query(
    'UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1',
    [apiKeyId]
  );
}

/**
 * Lists all API keys for a client (with sensitive data masked)
 */
export async function listApiKeys(apiClientId: number): Promise<ApiKeyData[]> {
  const result = await query(
    `SELECT 
      ak.id,
      ak.api_client_id,
      ac.customer_id,
      ak.key_prefix,
      ak.name,
      ak.scopes,
      ak.rate_limit,
      ak.is_active,
      ak.last_used_at,
      ak.expires_at,
      ak.created_at
     FROM api_keys ak
     JOIN api_clients ac ON ak.api_client_id = ac.id
     WHERE ak.api_client_id = $1
     ORDER BY ak.created_at DESC`,
    [apiClientId]
  );

  return result.rows;
}

/**
 * Updates API key settings
 */
export async function updateApiKey(
  apiKeyId: number,
  updates: {
    name?: string;
    scopes?: string[];
    rateLimit?: number;
    isActive?: boolean;
  }
): Promise<void> {
  const updateFields: string[] = [];
  const updateValues: (string | number | boolean | string[])[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    updateValues.push(updates.name);
  }

  if (updates.scopes !== undefined) {
    updateFields.push(`scopes = $${paramIndex++}`);
    updateValues.push(updates.scopes);
  }

  if (updates.rateLimit !== undefined) {
    updateFields.push(`rate_limit = $${paramIndex++}`);
    updateValues.push(updates.rateLimit);
  }

  if (updates.isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex++}`);
    updateValues.push(updates.isActive);
  }

  if (updateFields.length === 0) {
    return; // Nothing to update
  }

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(apiKeyId);

  const sql = `
    UPDATE api_keys 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
  `;

  await query(sql, updateValues);
}

/**
 * Gets API key usage statistics
 */
export async function getApiKeyUsage(
  apiKeyId: number,
  days: number = 7
): Promise<{
  totalRequests: number;
  totalCreditsUsed: number;
  avgResponseTime: number;
  errorRate: number;
}> {
  const result = await query(
    `SELECT 
      COUNT(*) as total_requests,
      SUM(credits_used) as total_credits_used,
      AVG(response_time_ms) as avg_response_time,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::float / COUNT(*) as error_rate
     FROM api_usage
     WHERE api_key_id = $1 
       AND created_at >= NOW() - INTERVAL '${days} days'`,
    [apiKeyId]
  );

  const row = result.rows[0];

  return {
    totalRequests: parseInt(row.total_requests) || 0,
    totalCreditsUsed: parseInt(row.total_credits_used) || 0,
    avgResponseTime: parseFloat(row.avg_response_time) || 0,
    errorRate: parseFloat(row.error_rate) || 0,
  };
}

/**
 * Creates an API client for a customer
 */
export async function createApiClient(
  customerId: number,
  name: string,
  description?: string,
  webhookUrl?: string
): Promise<number> {
  const result = await query(
    `INSERT INTO api_clients (customer_id, name, description, webhook_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [customerId, name, description, webhookUrl]
  );

  return result.rows[0].id;
}

/**
 * Gets all API clients for a customer
 */
export async function getApiClients(customerId: number) {
  const result = await query(
    `SELECT 
      ac.*,
      COUNT(ak.id) as key_count
     FROM api_clients ac
     LEFT JOIN api_keys ak ON ac.id = ak.api_client_id AND ak.is_active = true
     WHERE ac.customer_id = $1 AND ac.is_active = true
     GROUP BY ac.id
     ORDER BY ac.created_at DESC`,
    [customerId]
  );

  return result.rows;
}
