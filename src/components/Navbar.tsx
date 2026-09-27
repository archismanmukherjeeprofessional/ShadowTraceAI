import { useState } from 'react';
import type { User } from '../api/client';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  user: User | null;
  onLogout: () => void;
}

export default function Navbar({ currentPage, onNavigate, user, onLogout }: NavbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  return (
    <nav
      style={{
        height: '52px',
        background: '#1E293B',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        onClick={() => onNavigate('dashboard')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            background: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5.5" r="3.5" stroke="white" strokeWidth="1.5" />
            <path d="M8.5 8.5L12 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="5.5" cy="5.5" r="1" fill="white" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em', color: '#F1F5F9' }}>
          Shadow<span style={{ color: '#EF4444' }}>Trace</span>
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'investigations', label: 'Investigations' },
          
{ id: 'synthetic-db', label: 'Synthetic DB' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              background: currentPage === item.id ? '#334155' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: currentPage === item.id ? '#F1F5F9' : '#94A3B8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (currentPage !== item.id) (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1';
            }}
            onMouseLeave={(e) => {
              if (currentPage !== item.id) (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8';
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <svg
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: searchFocused ? '#94A3B8' : '#475569',
            transition: 'color 0.15s',
          }}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          placeholder="Search entities, cases..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            background: searchFocused ? '#334155' : '#0F172A',
            border: `1px solid ${searchFocused ? '#475569' : '#334155'}`,
            borderRadius: '6px',
            padding: '5px 12px 5px 32px',
            fontSize: '13px',
            color: '#F1F5F9',
            width: '220px',
            outline: 'none',
            transition: 'all 0.15s',
          }}
        />
        <kbd
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: '#475569',
            background: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '3px',
            padding: '1px 4px',
            fontFamily: 'inherit',
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94A3B8',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2a5 5 0 00-5 5v2.382l-1.447 2.894A.5.5 0 003 13h12a.5.5 0 00.447-.724L14 9.382V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7 13v1a2 2 0 004 0v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '7px',
              height: '7px',
              background: '#EF4444',
              borderRadius: '50%',
              border: '1.5px solid #1E293B',
            }}
          />
        </button>

        {notifOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '38px',
              width: '300px',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 200,
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', fontSize: '12px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Notifications
            </div>
            {[
              { text: 'New cluster detected in Operation Nightfall', time: '4m ago', dot: '#EF4444' },
              { text: 'Evidence confidence updated: 78 → 82', time: '22m ago', dot: '#F97316' },
              { text: 'Scheduled report generated for Q3 analysis', time: '1h ago', dot: '#3BB2F6' },
            ].map((n, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 16px',
                  borderBottom: i < 2 ? '1px solid #334155' : 'none',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.dot, marginTop: '5px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', color: '#CBD5E1' }}>{n.text}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          onClick={() => { setAvatarOpen(!avatarOpen); setNotifOpen(false); }}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3BB2F6, #6B7280)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
              outline: avatarOpen ? '2px solid #475569' : 'none',
              outlineOffset: '2px',
              transition: 'outline 0.1s',
            }}
          >
            {user ? user.name.slice(0, 2).toUpperCase() : '?'}
          </div>

        {avatarOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '38px',
              width: '220px',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 200,
              overflow: 'hidden',
            }}
          >
            {/* User info */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3BB2F6, #6B7280)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  {user ? user.name.slice(0, 2).toUpperCase() : '?'}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#F1F5F9' }}>{user?.name ?? '—'}</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>{user?.email ?? '—'}</div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            {[
              { label: 'Account settings', icon: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 18c0-3.314 3.134-6 7-6s7 2.686 7 6' },
              { label: 'Audit log', icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            ].map((item) => (
              <button
                key={item.label}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '9px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#334155';
                  (e.currentTarget as HTMLButtonElement).style.color = '#F1F5F9';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d={item.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </button>
            ))}

            <div style={{ height: '1px', background: '#334155', margin: '4px 0' }} />

            {/* Sign out */}
            <button
              onClick={() => { setAvatarOpen(false); onLogout(); }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                color: '#EF4444',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                <path d="M13 15l4-5-4-5M17 10H8M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
