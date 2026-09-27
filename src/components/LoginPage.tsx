import { useState } from 'react';
import { apiLogin, apiSignup, type User } from '../api/client';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onBack?: () => void;
}

export default function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Name is required.');
      return;
    }
    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await apiLogin(email, password)
          : await apiSignup(name.trim(), email, password);
      onLogin(result.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Left panel — branding */}
      <div
        style={{
          flex: '0 0 44%',
          background: '#1E293B',
          borderRight: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid pattern */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94A3B8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="white" strokeWidth="1.8" />
              <path d="M10.5 10.5L15 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="7" cy="7" r="1.5" fill="white" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: '#F1F5F9' }}>
            Shadow<span style={{ color: '#EF4444' }}>Trace</span>
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#475569', marginLeft: '6px', letterSpacing: '0.04em' }}>AI</span>
          </span>
        </div>

        {/* Center content */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#EF4444',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ width: '20px', height: '1px', background: '#EF4444' }} />
            Intelligence Platform
          </div>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 700,
              color: '#F1F5F9',
              margin: '0 0 16px',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
            }}
          >
            Evidence-first
            <br />
            <span style={{ color: '#94A3B8' }}>investigation</span>
            <br />
            at scale.
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0, lineHeight: 1.7, maxWidth: '320px' }}>
            Probabilistic analysis of complex networks. Every confidence score links to its supporting evidence.
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '32px', marginTop: '40px' }}>
            {[
              { value: '6 bands', label: 'Confidence scale' },
              { value: '∞', label: 'Evidence items' },
              { value: 'Dark-first', label: 'Analyst-optimized' },
            ].map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#F1F5F9',
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence band legend */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Confidence bands
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { label: '0–29', color: '#6B7280' },
              { label: '30–49', color: '#3BB2F6' },
              { label: '50–69', color: '#F59E0B' },
              { label: '70–84', color: '#F97316' },
              { label: '85–100', color: '#EF4444' },
            ].map((b) => (
              <div key={b.label} style={{ flex: 1 }}>
                <div style={{ height: '3px', background: b.color, borderRadius: '2px', marginBottom: '4px' }} />
                <div style={{ fontSize: '9px', color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#475569',
                fontSize: '13px',
                cursor: 'pointer',
                padding: '0',
                marginBottom: '28px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#94A3B8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
          )}
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              {mode === 'login'
                ? 'Authorised personnel only. All access is audited.'
                : 'Create a ShadowTrace account to get started.'}
            </p>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '2px', marginBottom: '8px' }}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1,
                  background: mode === m ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: mode === m ? '#F1F5F9' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name — signup only */}
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
                  Full name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  style={{
                    width: '100%',
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    color: '#F1F5F9',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#334155')}
                />
              </div>
            )}
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@agency.gov"
                autoComplete="email"
                style={{
                  width: '100%',
                  background: '#1E293B',
                  border: `1px solid ${error && !email ? '#EF4444' : '#334155'}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: '#F1F5F9',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
                onBlur={(e) => (e.currentTarget.style.borderColor = error && !email ? '#EF4444' : '#334155')}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>
                  Password
                </label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', fontSize: '12px', color: '#475569', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    background: '#1E293B',
                    border: `1px solid ${error && !password ? '#EF4444' : '#334155'}`,
                    borderRadius: '6px',
                    padding: '10px 40px 10px 14px',
                    fontSize: '14px',
                    color: '#F1F5F9',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = error && !password ? '#EF4444' : '#334155')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#475569',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                  }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2L14 14M6.5 6.6A2 2 0 0010.4 9.5M4.2 4.3C2.9 5.2 2 6.5 2 8c0 2.2 2.7 4.5 6 4.5 1.2 0 2.3-.3 3.2-.8M7 3.6C7.3 3.5 7.7 3.5 8 3.5c3.3 0 6 2.3 6 4.5 0 .8-.3 1.5-.8 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8c0-2.2 2.7-4.5 6-4.5S14 5.8 14 8s-2.7 4.5-6 4.5S2 10.2 2 8z" stroke="currentColor" strokeWidth="1.3" />
                      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#EF4444',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#7F1D1D' : '#EF4444',
                border: 'none',
                borderRadius: '6px',
                padding: '11px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#DC2626'; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#EF4444'; }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                    <path d="M7 1.5A5.5 5.5 0 0112.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Authenticating…
                </>
              ) : (
                mode === 'login' ? 'Sign in to ShadowTrace' : 'Create account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: '#334155' }} />
            <span style={{ fontSize: '11px', color: '#475569' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#334155' }} />
          </div>

          {/* Google — placeholder (OAuth not wired to backend) */}
          <button
            type="button"
            onClick={() => setError('Google sign-in is not available yet.')}
            style={{
              width: '100%',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#1a1a1a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
            }}
          >
            {/* Official Google G mark */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z" fill="#4285F4"/>
              <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
              <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9581H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
              <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9254L15.0218 2.344C13.4632 0.891773 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* SSO */}
          <button
            type="button"
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#475569';
              (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155';
              (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Continue with SSO
          </button>

          <p style={{ fontSize: '11px', color: '#334155', textAlign: 'center', marginTop: '28px', lineHeight: 1.6 }}>
            Unauthorised access attempts are logged and reported.<br />
            Use of this system implies acceptance of agency policy.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
