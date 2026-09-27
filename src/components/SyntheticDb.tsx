import { useState, useRef } from 'react';
import { apiImportSyntheticDb, apiGetSyntheticDbSchema } from '../api/client';

interface ImportStats {
  investigations: number;
  entities: number;
  observations: number;
  observations_skipped: number;
  edges: number;
  errors: { row: unknown; reason: string }[];
}

interface ImportResult {
  success: boolean;
  label: string;
  message: string;
  stats: ImportStats;
  id_map: Record<string, string>;
}

const EXAMPLE_DB = {
  label: "Example synthetic dataset",
  investigations: [
    { id: "inv_example_1", title: "Operation Phantom", description: "Cross-platform username investigation", target: "phantom_user", status: "active" },
  ],
  entities: [
    { id: "ent_1", type: "USERNAME", value: "phantom_user" },
    { id: "ent_2", type: "EMAIL",    value: "phantom@example.com" },
    { id: "ent_3", type: "DOMAIN",   value: "phantom-site.net" },
  ],
  observations: [
    { entity_type: "USERNAME", value: "phantom_user",          source_id: "github",   raw_reference: "https://github.com/phantom_user",         raw_excerpt: "Active GitHub account with 12 repos",           confidence: 0.9,  investigation_id: "inv_example_1" },
    { entity_type: "EMAIL",    value: "phantom@example.com",   source_id: "leak_db",  raw_reference: "breach:phantom@example.com:2023",          raw_excerpt: "Observed in credential dump 2023-Q2",           confidence: 0.85, investigation_id: "inv_example_1" },
  ],
  edges: [
    { source_entity_id: "ent_1", target_entity_id: "ent_2", evidence_type: "EMAIL_REUSE", effective_weight: 70 },
  ],
};

export default function SyntheticDb() {
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [schema, setSchema] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setError(''); setResult(null);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { setError('Invalid JSON — check your input and try again.'); return; }
    setLoading(true);
    try {
      const res = await apiImportSyntheticDb({ ...(parsed as object), label: label.trim() || undefined });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally { setLoading(false); }
  };

  const handleLoadSchema = async () => {
    setSchemaLoading(true);
    try { const res = await apiGetSyntheticDbSchema(); setSchema(res.schema); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load schema.'); }
    finally { setSchemaLoading(false); }
  };

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Synthetic Database Import</h1>
        <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Seed investigations, entities, observations, and evidence edges from a JSON file or paste.</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', color: '#CBD5E1', cursor: 'pointer' }}>
          Upload JSON file
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFile} />
        <button onClick={() => { setText(JSON.stringify(EXAMPLE_DB, null, 2)); setLabel('Example synthetic dataset'); }} style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', color: '#94A3B8', cursor: 'pointer' }}>Load example</button>
        <button onClick={handleLoadSchema} disabled={schemaLoading} style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '6px', padding: '7px 14px', fontSize: '13px', color: '#94A3B8', cursor: 'pointer' }}>
          {schemaLoading ? 'Loading…' : 'View schema'}
        </button>
        <div style={{ flex: 1 }} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dataset label (optional)" style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', color: '#F1F5F9', outline: 'none', width: '220px' }} />
      </div>

      {schema && (
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Schema</span>
            <button onClick={() => setSchema(null)} style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>✕</button>
          </div>
          <pre style={{ margin: 0, padding: '16px', fontSize: '12px', color: '#CBD5E1', overflowX: 'auto', lineHeight: '1.6', fontFamily: "'JetBrains Mono', monospace" }}>{JSON.stringify(schema, null, 2)}</pre>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8' }}>JSON payload</label>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'{\n  "investigations": [],\n  "entities": [],\n  "observations": [],\n  "edges": []\n}'}
          rows={18}
          style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '12px', fontSize: '12px', color: '#CBD5E1', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", lineHeight: '1.6' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#475569')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#334155')}
        />
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '13px', color: '#EF4444' }}>{error}</div>}

      <div>
        <button onClick={handleImport} disabled={loading || !text.trim()} style={{ background: loading || !text.trim() ? '#7F1D1D' : '#EF4444', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: loading || !text.trim() ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Importing…' : 'Import Database'}
        </button>
      </div>

      {result && (
        <div style={{ background: '#1E293B', border: `1px solid ${result.stats.errors.length ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.3)'}`, borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: result.stats.errors.length ? '#F59E0B' : '#10B981' }}>
              {result.stats.errors.length ? '⚠ Import completed with warnings' : '✓ Import successful'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>{result.message}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {([['Investigations', result.stats.investigations, '#3BB2F6'], ['Entities', result.stats.entities, '#A78BFA'], ['Observations', result.stats.observations, '#10B981'], ['Skipped', result.stats.observations_skipped, '#475569'], ['Edges', result.stats.edges, '#F59E0B']] as [string, number, string][]).map(([lbl, val, col]) => (
              <div key={lbl} style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: col, fontFamily: "'JetBrains Mono', monospace" }}>{val}</div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{lbl}</div>
              </div>
            ))}
          </div>
          {result.stats.errors.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#F59E0B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Row errors ({result.stats.errors.length})</div>
              <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {result.stats.errors.map((e, i) => <div key={i} style={{ fontSize: '12px', color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{e.reason}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}