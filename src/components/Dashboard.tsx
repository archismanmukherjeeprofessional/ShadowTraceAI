import { useState, useEffect, useCallback } from 'react';
import { apiGetInvestigations, apiDeleteInvestigation, type Investigation } from '../api/client';
import ConfidenceBadge from './ConfidenceBadge';

interface DashboardProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const statusConfig = {
  active: { label: 'Active', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' },
  escalated: { label: 'Escalated', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGetInvestigations();
      setInvestigations(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load investigations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvestigations();
  }, [loadInvestigations]);

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    try {
      await apiDeleteInvestigation(id);
      setInvestigations((prev) => prev.filter((i) => i.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = investigations.filter(
    (inv) => !statusFilter.length || statusFilter.includes(inv.status),
  );

  const toggleFilter = (val: string) => {
    setStatusFilter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  };

  const statCards = [
    { label: 'Total Investigations', value: investigations.length, color: '#10B981' },
    { label: 'Active', value: investigations.filter((i) => i.status === 'active').length, color: '#3BB2F6' },
  ];

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '220px',
          flexShrink: 0,
          background: '#1E293B',
          borderRight: '1px solid #334155',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          overflowY: 'auto',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: '#475569',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            Status
          </div>
          {(['active', 'escalated', 'pending', 'closed'] as const).map((s) => {
            const cfg = statusConfig[s] ?? statusConfig.active;
            const checked = statusFilter.includes(s);
            return (
              <label
                key={s}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer' }}
                onClick={() => toggleFilter(s)}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    border: `1px solid ${checked ? cfg.color : '#475569'}`,
                    background: checked ? cfg.bg : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: checked ? '#F1F5F9' : '#94A3B8', textTransform: 'capitalize' }}>
                  {s}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#475569' }}>
                  {investigations.filter((i) => i.status === s).length}
                </span>
              </label>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>
              Intelligence Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0' }}>
              {filtered.length} investigation{filtered.length !== 1 ? 's' : ''}
              {statusFilter.length ? ' (filtered)' : ''}
            </p>
          </div>
          <button
            onClick={() => onNavigate('investigation-detail', { id: 'new' })}
            style={{
              background: '#EF4444',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#DC2626')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#EF4444')}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
            New Investigation
          </button>
        </div>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxWidth: '480px' }}>
          {statCards.map((s) => (
            <div
              key={s.label}
              style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '16px 20px' }}
            >
              <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {s.value}
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#EF4444',
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
            Loading investigations…
          </div>
        )}

        {/* Investigation cards */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map((inv) => {
              const sc = statusConfig[inv.status] ?? statusConfig.active;
              return (
                <div
                  key={inv.id}
                  style={{
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '12px',
                    alignItems: 'start',
                  }}
                >
                  <div
                    onClick={() => onNavigate('investigation-detail', { id: inv.id })}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#F1F5F9' }}>{inv.title}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          background: sc.bg,
                          border: `1px solid ${sc.border}`,
                          color: sc.color,
                          fontWeight: 500,
                        }}
                      >
                        {sc.label}
                      </span>
                    </div>
                    {inv.description && (
                      <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 8px', lineHeight: '1.5', maxWidth: '600px' }}>
                        {inv.description}
                      </p>
                    )}
                    {inv.target && (
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        Target: <span style={{ color: '#CBD5E1' }}>{inv.target}</span>
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                      Updated {new Date(inv.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <ConfidenceBadge score={0} size="sm" />
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#475569',
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (confirm(`Delete "${inv.title}"?`)) handleDelete(inv.id);
                      }}
                      title="Delete investigation"
                    >
                      {deleteId === inv.id ? 'Deleting…' : '✕ delete'}
                    </span>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && !loading && (
              <div
                style={{
                  padding: '48px',
                  textAlign: 'center',
                  color: '#475569',
                  background: '#1E293B',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                }}
              >
                {statusFilter.length
                  ? 'No investigations match the selected filters.'
                  : 'No investigations yet. Create one to get started.'}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
