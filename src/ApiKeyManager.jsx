import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { AlertTriangle, Check, Clipboard, KeyRound, LoaderCircle, LogIn, LogOut, Plus, ShieldCheck, Trash2 } from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
const roles = [
  { value: 'read_only', label: 'Read only', description: 'Read API resources only' },
  { value: 'agent', label: 'Agent', description: 'Read and agent operations' },
  { value: 'admin', label: 'Admin', description: 'Read, agent, and admin operations' },
]

export default function ApiKeyManager({ onClose }) {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [clientName, setClientName] = useState('')
  const [roleScope, setRoleScope] = useState('read_only')
  const [keys, setKeys] = useState([])
  const [generatedKey, setGeneratedKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)

  const apiUrl = useMemo(() => supabaseUrl?.replace(/\/+$/, ''), [])
  const request = useCallback(async (method, body) => {
    if (!session?.access_token || !apiUrl || !supabaseAnonKey) {
      throw new Error('Sign in to your configured Supabase owner account first.')
    }
    const response = await fetch(`${apiUrl}/functions/v1/api-keys`, {
      method,
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `API key request failed (${response.status}).`)
    return result
  }, [apiUrl, session])

  const refreshKeys = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const result = await request('GET')
      setKeys(result.keys || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [request, session])

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError('Could not restore the Supabase session. Please sign in again.')
      setSession(data.session)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setGeneratedKey(null)
      setKeys([])
      setError('')
      setNotice('')
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    refreshKeys()
  }, [refreshKeys])

  const signIn = async (event) => {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      setPassword('')
    } catch {
      setError('Sign-in failed. Check the credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  const generateKey = async (event) => {
    event.preventDefault()
    if (!clientName.trim()) {
      setError('Enter a client name before generating a key.')
      return
    }
    setLoading(true)
    setError('')
    setNotice('')
    setGeneratedKey(null)
    setCopied(false)
    try {
      const result = await request('POST', { client_name: clientName.trim(), role_scope: roleScope })
      setGeneratedKey(result.key)
      setNotice(result.warning)
      setClientName('')
      await refreshKeys()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const copyKey = async () => {
    if (!generatedKey?.plain_key) return
    try {
      await navigator.clipboard.writeText(generatedKey.plain_key)
      setCopied(true)
    } catch {
      setError('Clipboard access was denied. Copy the key manually from the secure reveal box.')
    }
  }

  const revokeKey = async (id) => {
    if (!window.confirm('Revoke this API key immediately? Existing requests using it will stop working.')) return
    setLoading(true)
    setError('')
    try {
      await request('DELETE', { id })
      setKeys((current) => current.filter((key) => key.id !== id))
      setNotice('API key revoked.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setGeneratedKey(null)
    setKeys([])
  }

  return <div className="api-key-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="api-key-dialog" role="dialog" aria-modal="true" aria-labelledby="api-key-title">
      <header className="api-key-header">
        <div className="api-key-heading-icon"><KeyRound size={20} /></div>
        <div><span className="section-kicker">OWNER SECURITY</span><h2 id="api-key-title">API key management</h2><p>Generate and revoke scoped credentials for trusted clients.</p></div>
        <button className="icon-button" aria-label="Close API key manager" onClick={onClose}>×</button>
      </header>

      {!supabase ? <div className="api-key-empty"><AlertTriangle size={18} /><div><b>Supabase is not configured</b><span>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild the app.</span></div></div> : !session ? (
        <form className="api-key-login" onSubmit={signIn}>
          <div className="api-key-security-note"><ShieldCheck size={17} /><span>Sign in with a Supabase Auth owner account. Access is checked again by the server before every key operation.</span></div>
          <label>Owner email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="primary-button full-button" disabled={loading}><LogIn size={15} /> Sign in securely</button>
        </form>
      ) : (
        <>
          <div className="api-key-session"><span><ShieldCheck size={15} /> Supabase session active · Owner permission verified server-side</span><button className="secondary-button compact" onClick={signOut}><LogOut size={14} /> Sign out</button></div>
          <form className="api-key-create" onSubmit={generateKey}>
            <label>Client name<input maxLength="120" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="e.g. Collections integration" required /></label>
            <label>Role scope<select value={roleScope} onChange={(event) => setRoleScope(event.target.value)}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label} · {role.description}</option>)}</select></label>
            <button className="primary-button" disabled={loading}><Plus size={15} /> Generate key</button>
          </form>
          {generatedKey && <div className="api-key-reveal" role="status"><div><AlertTriangle size={16} /><b>Copy this key now — it will not be shown again.</b></div><code>{generatedKey.plain_key}</code><button className="secondary-button" onClick={copyKey}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? 'Copied' : 'Copy to clipboard'}</button></div>}
          {notice && <p className="api-key-notice">{notice}</p>}
          <div className="api-key-list-heading"><div><span className="section-kicker">ACTIVE CREDENTIALS</span><h3>Issued API keys</h3></div><span>{keys.length} active</span></div>
          {error && <p className="api-key-error" role="alert">{error}</p>}
          {loading && <div className="api-key-loading"><LoaderCircle size={16} /> Working securely…</div>}
          {!loading && keys.length === 0 && !error && <div className="api-key-no-rows">No active API keys.</div>}
          <div className="api-key-list">{keys.map((key) => <article className="api-key-row" key={key.id}><div className="api-key-row-icon"><KeyRound size={16} /></div><div className="api-key-row-main"><b>{key.client_name}</b><span><code>{key.key_prefix}••••••••</code> · {roles.find((role) => role.value === key.role_scope)?.label || key.role_scope}</span><small>{key.rate_limit} requests/min · Created {new Date(key.created_at).toLocaleDateString()}</small></div><button className="api-key-revoke" disabled={loading} onClick={() => revokeKey(key.id)} aria-label={`Revoke ${key.client_name}`}><Trash2 size={15} /> Revoke</button></article>)}</div>
          <p className="api-key-footnote">Full keys are never stored or listed. Keep credentials server-side; never include them in frontend code or source control.</p>
        </>
      )}
      {error && !session && <p className="api-key-error" role="alert">{error}</p>}
    </section>
  </div>
}
