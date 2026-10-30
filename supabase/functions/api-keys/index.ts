import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const allowedOrigin = Deno.env.get('APP_ORIGIN')

if (!supabaseUrl || !serviceRoleKey || !allowedOrigin) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and APP_ORIGIN must be configured.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const corsHeaders = {
  'access-control-allow-origin': allowedOrigin,
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-max-age': '86400',
  vary: 'Origin',
}
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

type OwnerResult = { response: Response; userId?: never } | { userId: string; response?: never }

async function requireOwner(request: Request): Promise<OwnerResult> {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) return { response: json(401, { error: 'Sign in with an authorized owner account.' }) }
  const { data, error } = await supabase.auth.getUser(match[1])
  if (error || !data.user) return { response: json(401, { error: 'The owner session is invalid or expired.' }) }
  const role = data.user.app_metadata?.role
  if (role !== 'owner') return { response: json(403, { error: 'Owner access is required for API key administration.' }) }
  return { userId: data.user.id }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  if (origin && origin !== allowedOrigin) return json(403, { error: 'Origin is not allowed.' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const owner = await requireOwner(request)
  if (owner.response) return owner.response

  if (request.method === 'GET') {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, client_name, key_prefix, role_scope, rate_limit, is_active, created_at, updated_at, last_used_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('API key list failed:', error.message)
      return json(500, { error: 'Could not load API keys.' })
    }
    return json(200, { keys: data })
  }

  if (request.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'Request body must be valid JSON.' })
    }
    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : ''
    const roleScope = body.role_scope
    if (clientName.length < 1 || clientName.length > 120 || !['read_only', 'agent', 'admin'].includes(String(roleScope))) {
      return json(400, { error: 'Provide a client name and a valid role scope.' })
    }

    const key = `devman_live_sk_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
    const hashedKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        client_name: clientName,
        hashed_key: hashedKey,
        key_prefix: 'devman_live_sk_',
        role_scope: roleScope,
        rate_limit: 60,
      })
      .select('id, client_name, key_prefix, role_scope, rate_limit, is_active, created_at, last_used_at')
      .single()
    if (error) {
      console.error('API key creation failed:', error.message)
      return json(500, { error: 'Could not create an API key.' })
    }
    return json(201, {
      key: { ...data, plain_key: key },
      warning: 'Copy this key now. It cannot be retrieved after you leave this screen.',
    })
  }

  if (request.method === 'DELETE') {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'Request body must be valid JSON.' })
    }
    const id = typeof body.id === 'string' ? body.id : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json(400, { error: 'A valid key id is required.' })
    }
    const { data, error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)
      .eq('is_active', true)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('API key revocation failed:', error.message)
      return json(500, { error: 'Could not revoke the API key.' })
    }
    if (!data) return json(404, { error: 'Active API key not found.' })
    return json(200, { revoked: true })
  }

  return json(405, { error: 'Method not allowed.' })
})
