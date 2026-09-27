import { useState, useEffect, useCallback, useRef } from 'react';
import {
  apiGetInvestigation,
  apiCreateInvestigation,
  apiGetObservations,
  apiCreateObservation,
  apiAnalyze,
  apiSearchEntities,
  type Investigation,
  type Observation,
  type Analysis,
  type Entity,
} from '../api/client';
import ConfidenceBadge from './ConfidenceBadge';

interface InvestigationDetailProps {
  id: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type Tab = 'overview' | 'observations' | 'analyze' | 'timeline' | 'report';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'observations', label: 'Observations' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'report', label: 'Report' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: 'Active', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  pending: { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' },
  escalated: { label: 'Escalated', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
};

// ============================================================
// NEW INVESTIGATION FORM
// ============================================================

function NewInvestigationForm({
  onCreated,
  onCancel,
}: {
  onCreated: (inv: Investigation) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const inv = await apiCreateInvestigation({ title: title.trim(), description: description.trim(), target: target.trim() });
      onCreated(inv);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create investigation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '560px', margin: '48px auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 24px', letterSpacing: '-0.02em' }}>
        New Investigation
      </h2>
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '13px', color: '#EF4444', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
            Title <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Operation Nightfall"
            style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '10px 14px', fontSize: '14px', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#334155')}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
            Target
          </label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Person, organisation, or IP"
            style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '10px 14px', fontSize: '14px', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#334155')}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginBottom: '6px' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the investigation..."
            rows={4}
            style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '10px 14px', fontSize: '14px', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#334155')}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? '#7F1D1D' : '#EF4444', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating…' : 'Create Investigation'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '6px', padding: '10px 20px', fontSize: '13px', color: '#94A3B8', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// ADD OBSERVATION FORM
// ============================================================

function AddObservationForm({
  investigationId,
  onAdded,
}: {
  investigationId: string;
  onAdded: (obs: Observation) => void;
}) {
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const [type, setType] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) { setError('Content is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const obs = await apiCreateObservation(investigationId, { content: content.trim(), source: source.trim() || 'manual', type: type || 'general' });
      onAdded(obs);
      setContent('');
      setSource('');
      setType('general');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add observation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Add Observation
      </div>
      {error && (
        <div style={{ fontSize: '12px', color: '#EF4444', padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe what you observed..."
        rows={3}
        style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (optional)"
          style={{ flex: 1, background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#F1F5F9', outline: 'none' }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#F1F5F9', outline: 'none' }}
        >
          {['general', 'financial', 'digital', 'geospatial', 'corporate', 'communication'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          style={{ background: '#EF4444', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// ============================================================
// ANALYZE TAB
// ============================================================

function AnalyzeTab({ investigationId, observations }: { investigationId: string; observations: Observation[] }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
// Entity search
  const [entityQuery, setEntityQuery] = useState('');
  const [entityResults, setEntityResults] = useState<Entity[]>([]);
  const [entitySearching, setEntitySearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleEntityQueryChange = (q: string) => {
    setEntityQuery(q);
    setSelectedEntity(null);
    setShowDropdown(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setEntityResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setEntitySearching(true);
      try {
        setEntityResults(await apiSearchEntities(q));
      } catch {
        setEntityResults([]);
      } finally {
        setEntitySearching(false);
      }
    }, 300);
  };

  const handleSelectEntity = (entity: Entity) => {
    if (!entity.id) {
      // eslint-disable-next-line no-console
      console.warn('Entity search result is missing an id — check the /entities/search response shape:', entity);
    }
    setSelectedEntity(entity);
    setEntityQuery(entity.value ?? entity.id ?? '');
    setShowDropdown(false);
    setEntityResults([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAnalyze = async () => {
    
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const analysis = await apiAnalyze({
        investigationId,
        entityId: selectedEntity?.id,
        text: text.trim() || undefined,
      });
      setResult(analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const riskColor = { low: '#10B981', medium: '#F59E0B', high: '#EF4444' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '13px', color: '#94A3B8' }}>
        Optionally select an entity to scope the analysis. Enter text to analyze, or leave blank to analyze all {observations.length} observation{observations.length !== 1 ? 's' : ''} in this investigation.
      </div>

      {/* Entity search */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
          Entity <span style={{ color: '#64748B', textTransform: 'none', fontWeight: 400, letterSpacing: 'normal' }}>(optional)</span>
        </label>
        <input
          value={entityQuery}
          onChange={(e) => handleEntityQueryChange(e.target.value)}
          onFocus={() => entityResults.length > 0 && setShowDropdown(true)}
          placeholder="Search entity by name, or leave blank to analyze at the investigation level…"
          style={{ width: '100%', background: '#1E293B', border: `1px solid ${selectedEntity ? '#10B981' : '#334155'}`, borderRadius: '6px', padding: '9px 12px', fontSize: '13px', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box' }}
        />
        {entitySearching && (
          <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(20%)', fontSize: '11px', color: '#475569' }}>…</div>
        )}
        {showDropdown && entityResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', marginTop: '4px', zIndex: 50, maxHeight: '180px', overflowY: 'auto' }}>
            {entityResults.map((e, i) => (
              <div
                key={e.id ?? i}
                onMouseDown={() => handleSelectEntity(e)}
                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = '#243047')}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: '#F1F5F9' }}>{e.value ?? e.id ?? 'Unknown entity'}</span>
                <span style={{ fontSize: '11px', color: '#475569', textTransform: 'capitalize' }}>{e.type}</span>
              </div>
            ))}
          </div>
        )}
        {selectedEntity && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: '#10B981' }}>
            ID: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selectedEntity.id}</span>
          </div>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text to analyze for risk signals..."
        rows={5}
        style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#F1F5F9', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
      />
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '13px', color: '#EF4444' }}>
          {error}
        </div>
      )}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{ background: loading ? '#7F1D1D' : '#EF4444', border: 'none', borderRadius: '6px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: loading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}
      >
        {loading ? 'Analyzing…' : 'Run Analysis'}
      </button>

      {result && (
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 700, color: riskColor[result.riskLevel], fontFamily: "'JetBrains Mono', monospace" }}>
                {result.riskScore}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Score</div>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: riskColor[result.riskLevel], textTransform: 'capitalize' }}>
                {result.riskLevel} Risk
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>{result.summary}</div>
            </div>
          </div>

          {/* Signals */}
          {(result.signals?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Detected Signals
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {result.signals.map((s) => (
                  <span
                    key={s.category}
                    style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: '#0F172A', border: '1px solid #334155', color: '#CBD5E1' }}
                  >
                    {s.category}: {s.matches.join(', ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {(result.recommendations?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Recommendations
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {result.recommendations.map((r, i) => (
                  <li key={i} style={{ fontSize: '13px', color: '#CBD5E1' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {result.disclaimer && (
            <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px solid #334155', paddingTop: '12px' }}>
              {result.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function InvestigationDetail({ id, onNavigate }: InvestigationDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingObs, setLoadingObs] = useState(false);
  const [error, setError] = useState('');

  const isNew = id === 'new' || id === '';

  const loadInvestigation = useCallback(async () => {
    if (isNew) { setLoadingInv(false); return; }
    setLoadingInv(true);
    setError('');
    try {
      const inv = await apiGetInvestigation(id);
      setInvestigation(inv);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load investigation.');
    } finally {
      setLoadingInv(false);
    }
  }, [id, isNew]);

  const loadObservations = useCallback(async () => {
    if (isNew || !investigation) return;
    setLoadingObs(true);
    try {
      setObservations(await apiGetObservations(investigation.id));
    } catch {
      // non-critical
    } finally {
      setLoadingObs(false);
    }
  }, [isNew, investigation]);

  useEffect(() => { loadInvestigation(); }, [loadInvestigation]);
  useEffect(() => { loadObservations(); }, [loadObservations]);

  // ---- NEW INVESTIGATION ----

  if (isNew) {
    return (
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{ width: '200px', flexShrink: 0, background: '#1E293B', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', padding: '16px 12px' }}
        >
          <button
            onClick={() => onNavigate('investigations')}
            style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', padding: '4px' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Investigations
          </button>
        </aside>
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <NewInvestigationForm
            onCreated={(inv) => onNavigate('investigation-detail', { id: inv.id })}
            onCancel={() => onNavigate('investigations')}
          />
        </main>
      </div>
    );
  }

  // ---- LOADING ----

  if (loadingInv) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '13px' }}>
        Loading investigation…
      </div>
    );
  }

  // ---- ERROR ----

  if (error || !investigation) {
    return (
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ color: '#EF4444', fontSize: '14px' }}>{error || 'Investigation not found.'}</div>
        <button
          onClick={() => onNavigate('investigations')}
          style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', color: '#94A3B8', cursor: 'pointer' }}
        >
          Back to Investigations
        </button>
      </div>
    );
  }

  const sc = statusConfig[investigation.status] ?? statusConfig.active;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Sidebar with sub-nav */}
      <aside
        style={{
          width: '200px',
          flexShrink: 0,
          background: '#1E293B',
          borderRight: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: '4px',
        }}
      >
        <button
          onClick={() => onNavigate('investigations')}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#94A3B8',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 4px 12px',
            marginBottom: '4px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Investigations
        </button>

        <div style={{ fontSize: '10px', fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 4px 8px', borderBottom: '1px solid #334155', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {investigation.id}
        </div>

        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? '#334155' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 10px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 500 : 400,
              color: activeTab === tab.id ? '#F1F5F9' : '#94A3B8',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'; }}
            onMouseLeave={(e) => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
          >
            {tab.label}
            {tab.id === 'observations' && observations.length > 0 && (
              <span style={{ marginLeft: '6px', fontSize: '10px', color: '#475569' }}>{observations.length}</span>
            )}
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {/* Investigation header */}
        <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>
                  {investigation.title}
                </h1>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '3px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontWeight: 500 }}>
                  {sc.label}
                </span>
              </div>
              {investigation.description && (
                <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: '1.5', maxWidth: '600px' }}>
                  {investigation.description}
                </p>
              )}
            </div>
            <ConfidenceBadge score={0} showLabel size="lg" />
          </div>

          <div style={{ display: 'flex', gap: '24px', marginTop: '14px', flexWrap: 'wrap' }}>
            {[
              { label: 'Target', value: investigation.target || '—' },
              { label: 'Observations', value: String(observations.length) },
              { label: 'Opened', value: new Date(investigation.createdAt).toLocaleDateString() },
              { label: 'Updated', value: new Date(investigation.updatedAt).toLocaleDateString() },
            ].map((m) => (
              <div key={m.label}>
                <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '14px', color: '#CBD5E1', marginTop: '2px' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab content */}

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                About this Investigation
              </div>
              <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {investigation.description ? (
                  <p style={{ fontSize: '13px', color: '#CBD5E1', margin: 0, lineHeight: '1.7' }}>{investigation.description}</p>
                ) : (
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0, fontStyle: 'italic' }}>No description provided.</p>
                )}
                {investigation.target && (
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                    Target: <span style={{ color: '#F1F5F9' }}>{investigation.target}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent observations preview */}
            {observations.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Recent Observations
                </div>
                <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
                  {observations.slice(0, 3).map((obs, i) => (
                    <div
                      key={obs.id}
                      style={{ padding: '12px 16px', borderBottom: i < Math.min(3, observations.length) - 1 ? '1px solid #334155' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: '#0F172A', border: '1px solid #334155', color: '#94A3B8', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                        {obs.type}
                      </span>
                      <span style={{ fontSize: '13px', color: '#CBD5E1', flex: 1 }}>{obs.content}</span>
                      <span style={{ fontSize: '11px', color: '#475569', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                        {new Date(obs.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
                {observations.length > 3 && (
                  <button
                    onClick={() => setActiveTab('observations')}
                    style={{ marginTop: '8px', background: 'transparent', border: 'none', color: '#3BB2F6', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    View all {observations.length} observations →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'observations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <AddObservationForm
              investigationId={investigation.id}
              onAdded={(obs) => setObservations((prev) => [obs, ...prev])}
            />

            {loadingObs && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                Loading observations…
              </div>
            )}

            {!loadingObs && observations.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#475569', background: '#1E293B', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px' }}>
                No observations yet. Add the first one above.
              </div>
            )}

            {observations.map((obs) => (
              <div key={obs.id} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#475569' }}>{obs.id}</span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: '#0F172A', border: '1px solid #334155', color: '#94A3B8', textTransform: 'capitalize' }}>{obs.type}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#CBD5E1', margin: 0, lineHeight: '1.6' }}>{obs.content}</p>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569' }}>
                      Source: <span style={{ color: '#94A3B8' }}>{obs.source}</span>
                      {' · '}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{new Date(obs.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analyze' && (
          <AnalyzeTab investigationId={investigation.id} observations={observations} />
        )}

        {activeTab === 'timeline' && (
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            <div style={{ position: 'absolute', left: '6px', top: 0, bottom: 0, width: '1px', background: '#334155' }} />
            {[
              { date: investigation.createdAt, event: 'Investigation created', type: 'system' },
              ...observations.map((o) => ({ date: o.createdAt, event: `Observation added: ${o.content.slice(0, 80)}${o.content.length > 80 ? '…' : ''}`, type: 'evidence' })),
              ...(investigation.updatedAt !== investigation.createdAt
                ? [{ date: investigation.updatedAt, event: 'Investigation last updated', type: 'system' }]
                : []),
            ]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((ev, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: '20px', paddingLeft: '20px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '-18px',
                      top: '4px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: ev.type === 'evidence' ? '#3BB2F6' : '#475569',
                      border: '2px solid #0F172A',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#475569', fontFamily: "'JetBrains Mono', monospace", marginBottom: '2px' }}>
                    {new Date(ev.date).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '13px', color: '#CBD5E1' }}>{ev.event}</div>
                </div>
              ))}
          </div>
        )}

        {activeTab === 'report' && (
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F1F5F9', margin: 0 }}>Intelligence Report Draft</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', color: '#94A3B8', cursor: 'pointer' }}>
                  Export PDF
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', color: '#CBD5E1', lineHeight: '1.7' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Investigation
                </div>
                <p style={{ margin: 0 }}>{investigation.title}</p>
              </div>
              {investigation.description && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Description
                  </div>
                  <p style={{ margin: 0 }}>{investigation.description}</p>
                </div>
              )}
              {investigation.target && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Target
                  </div>
                  <p style={{ margin: 0 }}>{investigation.target}</p>
                </div>
              )}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Observations ({observations.length})
                </div>
                {observations.length === 0 ? (
                  <p style={{ margin: 0, color: '#475569', fontStyle: 'italic' }}>No observations recorded.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {observations.map((obs) => (
                      <li key={obs.id}>{obs.content}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                Report generated {new Date().toISOString().split('T')[0]} · Investigation: {investigation.id}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
