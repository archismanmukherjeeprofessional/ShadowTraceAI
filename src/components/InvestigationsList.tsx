import { useState, useEffect, useCallback } from 'react';
import { apiGetInvestigations, type Investigation } from '../api/client';
import ConfidenceBadge from './ConfidenceBadge';

interface InvestigationsListProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const statusConfig = {
  active: { label: 'Active', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' },
  escalated: { label: 'Escalated', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
};

type SortKey = 'title' | 'updatedAt' | 'createdAt';

export default function InvestigationsList({ onNavigate }: InvestigationsListProps) {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [view, setView] = useState<'table' | 'grid'>('table');

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInvestigations(await apiGetInvestigations());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load investigations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvestigations();
  }, [loadInvestigations]);

  const handleSort = (key: SortKey) => {
    if (sort === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setSortDir('desc'); }
  };

  const sorted = [...investigations]
    .filter((inv) => {
      const q = search.toLowerCase();
      return (
        !q ||
        inv.title.toLowerCase().includes(q) ||
        inv.description.toLowerCase().includes(q) ||
        inv.target.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sort === 'title') cmp = a.title.localeCompare(b.title);
      else if (sort === 'updatedAt') cmp = a.updatedAt.localeCompare(b.updatedAt);
      else if (sort === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: SortKey }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: sort === field ? 1 : 0.3 }}>
      {sortDir === 'asc' && sort === field ? (
        <path d="M5 2L8 7H2L5 2Z" fill="currentColor" />
      ) : (
        <path d="M5 8L2 3H8L5 8Z" fill="currentColor" />
      )}
    </svg>
  );

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>
              Investigations
            </h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0' }}>
              {sorted.length} of {investigations.length} investigations
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '2px' }}>
              {(['table', 'grid'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    background: view === v ? '#334155' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    color: view === v ? '#F1F5F9' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {v === 'table' ? '≡' : '⊞'}
                </button>
              ))}
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
              }}
            >
              <span>+</span> New
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '13px', color: '#EF4444' }}>
            {error}
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, target..."
            style={{
              width: '100%',
              background: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '9px 12px 9px 36px',
              fontSize: '14px',
              color: '#F1F5F9',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
            Loading investigations…
          </div>
        )}

        {/* Table view */}
        {!loading && view === 'table' && (
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {[
                    { key: 'title' as SortKey, label: 'Investigation' },
                    { key: null, label: 'Status' },
                    { key: null, label: 'Target' },
                    { key: 'updatedAt' as SortKey, label: 'Updated' },
                    { key: 'createdAt' as SortKey, label: 'Created' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      onClick={col.key ? () => handleSort(col.key!) : undefined}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#475569',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: col.key ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {col.label}
                        {col.key && <SortIcon field={col.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((inv, idx) => {
                  const sc = statusConfig[inv.status] ?? statusConfig.active;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => onNavigate('investigation-detail', { id: inv.id })}
                      style={{
                        borderBottom: idx < sorted.length - 1 ? '1px solid #334155' : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#243047')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#F1F5F9' }}>{inv.title}</span>
                        {inv.description && (
                          <div style={{ marginTop: '2px', fontSize: '12px', color: '#475569', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontWeight: 500 }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#94A3B8' }}>
                        {inv.target || <span style={{ color: '#334155' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(inv.updatedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid view */}
        {!loading && view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {sorted.map((inv) => {
              const sc = statusConfig[inv.status] ?? statusConfig.active;
              return (
                <div
                  key={inv.id}
                  onClick={() => onNavigate('investigation-detail', { id: inv.id })}
                  style={{
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#475569')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = '#334155')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9' }}>{inv.title}</span>
                    <ConfidenceBadge score={0} size="sm" />
                  </div>
                  {inv.description && (
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }}>
                      {inv.description.slice(0, 100)}{inv.description.length > 100 ? '…' : ''}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '3px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
                      {sc.label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#475569' }}>
                      {new Date(inv.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#475569', background: '#1E293B', borderRadius: '8px', border: '1px solid #334155' }}>
            {search ? 'No investigations match your search.' : 'No investigations yet. Create one to get started.'}
          </div>
        )}
      </main>
    </div>
  );
}
