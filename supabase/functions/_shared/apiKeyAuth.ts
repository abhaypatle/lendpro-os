import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type ApiKeyRole = 'read_only' | 'agent' | 'admin'

export type AuthenticatedApiKeyRequest = Request & {
  authRole: ApiKeyRole
  apiKeyId: string
}

export type ApiKeyAuthResult =
  | { request: AuthenticatedApiKeyRequest; response?: never }
  | { request?: never; response: Response }

const json = (status: number, body: Record<string, string>, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })

export async function authenticateApiKey(
  request: Request,
  supabase: SupabaseClient,
): Promise<ApiKeyAuthResult> {
  const rawKey = request.headers.get('x-api-key') || ''
  if (!/^devman_live_sk_[0-9a-f]{64}$/.test(rawKey)) {
    return { response: json(401, { error: 'A valid x-api-key is required.' }) }
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey))
  const hashedKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const { data: keyRecord, error } = await supabase
    .from('api_keys')
    .select('id, role_scope, rate_limit')
    .eq('hashed_key', hashedKey)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('API key lookup failed:', error.message)
    return { response: json(503, { error: 'API key authentication is temporarily unavailable.' }) }
  }
  if (!keyRecord) return { response: json(401, { error: 'Invalid or revoked API key.' }) }

  const { data: allowed, error: rateError } = await supabase.rpc('consume_api_key_request', {
    p_api_key_id: keyRecord.id,
    p_limit: keyRecord.rate_limit,
  })
  if (rateError) {
    console.error('API key rate limit check failed:', rateError.message)
    return { response: json(503, { error: 'API key authorization is temporarily unavailable.' }) }
  }
  if (!allowed) return { response: json(429, { error: 'API key rate limit exceeded.' }) }

  const { error: updateError } = await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .eq('is_active', true)
  if (updateError) {
    console.error('API key last-used update failed:', updateError.message)
    return { response: json(503, { error: 'API key authorization is temporarily unavailable.' }) }
  }

  const authenticatedRequest = Object.assign(request, {
    authRole: keyRecord.role_scope as ApiKeyRole,
    apiKeyId: keyRecord.id as string,
  })
  return { request: authenticatedRequest }
}
