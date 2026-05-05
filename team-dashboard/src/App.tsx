import { useEffect, useMemo, useState } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import {
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

type EventRow = {
  event_name: string
  payload_json: Record<string, unknown> | null
  created_at: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const ALLOWED_EMAILS = String(import.meta.env.VITE_DASHBOARD_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

const LOOKBACK_DAYS = 14

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

function count(rows: EventRow[], name: string): number {
  return rows.filter((r) => r.event_name === name).length
}

function Dashboard({ rows }: { rows: EventRow[] }) {
  const onboardingCompleted = count(rows, 'onboarding_completed')
  const scanStarted = count(rows, 'scan_started')
  const scanSucceeded = count(rows, 'scan_succeeded')
  const paywallShown = count(rows, 'paywall_shown')
  const paywallPurchased = count(rows, 'paywall_purchased')
  const copyRows = rows.filter((r) => r.event_name === 'scan_copy_quality')
  const weakCopyScans = copyRows.filter((r) => Boolean(r.payload_json?.has_weak_copy)).length
  const weakCopyRate = copyRows.length > 0 ? Math.round((weakCopyScans / copyRows.length) * 1000) / 10 : 0

  const funnelData = [
    { name: 'Onboarding done', value: onboardingCompleted },
    { name: 'Scan started', value: scanStarted },
    { name: 'Scan succeeded', value: scanSucceeded },
    { name: 'Paywall shown', value: paywallShown },
    { name: 'Paywall purchased', value: paywallPurchased },
  ]

  return (
    <div className="page">
      <h1>Fillr Team Dashboard</h1>
      <p className="sub">Last {LOOKBACK_DAYS} days</p>

      <div className="cards">
        <div className="card">
          <div className="label">Scans succeeded</div>
          <div className="value">{scanSucceeded}</div>
        </div>
        <div className="card">
          <div className="label">Paywall conversion</div>
          <div className="value">
            {paywallShown > 0 ? `${Math.round((paywallPurchased / paywallShown) * 1000) / 10}%` : '0%'}
          </div>
        </div>
        <div className="card">
          <div className="label">Weak copy scan rate</div>
          <div className="value">{weakCopyRate}%</div>
        </div>
      </div>

      <div className="chartCard">
        <div className="label">Funnel</div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <FunnelChart>
              <Tooltip />
              <CartesianGrid strokeDasharray="3 3" />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<EventRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const userEmail = session?.user?.email?.toLowerCase().trim() ?? ''
  const internalAllowed = ALLOWED_EMAILS.length === 0 ? true : ALLOWED_EMAILS.includes(userEmail)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session || !internalAllowed) return
    let alive = true
    void (async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data, error: qErr } = await supabase
        .from('scan_result_events')
        .select('event_name,payload_json,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000)
      if (!alive) return
      if (qErr) setError(qErr.message)
      else setRows((data as EventRow[] | null) ?? [])
    })()
    return () => {
      alive = false
    }
  }, [session, internalAllowed])

  const isConfigured = useMemo(() => Boolean(supabase), [])

  if (!isConfigured) {
    return <div className="center">Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`.</div>
  }

  if (!session) {
    return (
      <div className="center">
        <div className="auth">
          <h2>Team dashboard login</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            disabled={loading}
            onClick={async () => {
              if (!supabase) return
              setLoading(true)
              setError(null)
              const { error } = await supabase.auth.signInWithPassword({ email, password })
              if (error) setError(error.message)
              setLoading(false)
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    )
  }

  if (!internalAllowed) {
    return <div className="center">This dashboard is restricted to authorized team accounts.</div>
  }

  return (
    <>
      <div className="topbar">
        <span>{session.user.email}</span>
        <button
          onClick={async () => {
            if (!supabase) return
            await supabase.auth.signOut()
          }}
        >
          Sign out
        </button>
      </div>
      <Dashboard rows={rows} />
    </>
  )
}
