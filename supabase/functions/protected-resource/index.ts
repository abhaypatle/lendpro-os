import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { authenticateApiKey } from '../_shared/apiKeyAuth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async (request) => {
  const authentication = await authenticateApiKey(request, supabase)
  if (authentication.response) return authentication.response
  const { authRole, apiKeyId } = authentication.request

  return new Response(JSON.stringify({
    message: 'API key accepted.',
    authRole,
    apiKeyId,
    capabilities: authRole === 'read_only' ? ['read'] : authRole === 'agent' ? ['read', 'agent'] : ['read', 'agent', 'admin'],
  }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
})
