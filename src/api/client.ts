// ============================================================
// API CLIENT
// All requests go through /api (proxied to backend :5000 in dev).
// The JWT token is stored in localStorage and sent as a Bearer
// header on every authenticated request.
// ============================================================

const BASE = '/api';

// ---- token helpers ----

export function getToken(): string | null {
  return localStorage.getItem('st_token');
}

export function setToken(token: string): void {
  localStorage.setItem('st_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('st_token');
}

// ---- generic fetch ----

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError((data && data.message) || 'Request failed', res.status);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================================
// TYPES
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Investigation {
  id: string;
  userId: string;
  title: string;
  description: string;
  target: string;
  status: 'active';
  createdAt: string;
  updatedAt: string;
}

export interface Observation {
  id: string;
  investigationId: string;
  userId: string;
  content: string;
  source: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AnalysisSignal {
  category: string;
  matches: string[];
  count: number;
}

export interface Analysis {
  id: string;
  investigationId: string | null;
  analyzedAt: string;
  summary: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  signals: AnalysisSignal[];
  recommendations: string[];
  disclaimer: string;
}

// ============================================================
// AUTH
// ============================================================

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const data = await request<{ success: boolean; token: string; user: User }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
  setToken(data.token);
  return data;
}

export async function apiSignup(
  name: string,
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const data = await request<{ success: boolean; token: string; user: User }>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    },
  );
  setToken(data.token);
  return data;
}

export async function apiMe(): Promise<User> {
  const data = await request<{ success: boolean; user: User }>('/auth/me');
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' }).catch(() => {});
  clearToken();
}

// ============================================================
// INVESTIGATIONS
// ============================================================

export async function apiGetInvestigations(): Promise<Investigation[]> {
  const data = await request<{ success: boolean; investigations: Investigation[] }>(
    '/investigations',
  );
  return data.investigations;
}

export async function apiGetInvestigation(id: string): Promise<Investigation> {
  const data = await request<{ success: boolean; investigation: Investigation }>(
    `/investigations/${id}`,
  );
  return data.investigation;
}

export async function apiCreateInvestigation(payload: {
  title: string;
  description?: string;
  target?: string;
}): Promise<Investigation> {
  const data = await request<{ success: boolean; investigation: Investigation }>(
    '/investigations',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return data.investigation;
}

export async function apiDeleteInvestigation(id: string): Promise<void> {
  await request(`/investigations/${id}`, { method: 'DELETE' });
}

// ============================================================
// OBSERVATIONS
// ============================================================

export async function apiGetObservations(investigationId: string): Promise<Observation[]> {
  const data = await request<{ success: boolean; observations: Observation[] }>(
    `/investigations/${investigationId}/observations`,
  );
  return data.observations;
}

export async function apiCreateObservation(
  investigationId: string,
  payload: { content: string; source?: string; type?: string },
): Promise<Observation> {
  const data = await request<{ success: boolean; observation: Observation }>(
    `/investigations/${investigationId}/observations`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return data.observation;
}
// ============================================================
// ENTITIES
// ============================================================

export interface Entity {
  id: string;
  value: string;
  type: string;
}

export async function apiSearchEntities(q: string): Promise<Entity[]> {
  const data = await request<{ success: boolean; results: Entity[] }>(
    `/entities/search?q=${encodeURIComponent(q)}`,
  );
  return data.results ?? [];
}

// ============================================================
// ANALYZE
// ============================================================

export async function apiAnalyze(payload: {
  investigationId?: string;
  entityId?: string;
  text?: string;
}): Promise<Analysis> {
  // Backend uses snake_case; map camelCase fields before sending
  const body: Record<string, unknown> = {};
  if (payload.investigationId) body.investigationId = payload.investigationId;
  if (payload.entityId)        body.entity_id       = payload.entityId;
  if (payload.text)            body.text            = payload.text;

  const data = await request<Analysis & { success: boolean }>('/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}
// ============================================================
// SYNTHETIC DATABASE
// ============================================================

export async function apiImportSyntheticDb(payload: object): Promise<{
  success: boolean; label: string; message: string;
  stats: { investigations: number; entities: number; observations: number; observations_skipped: number; edges: number; errors: { row: unknown; reason: string }[] };
  id_map: Record<string, string>;
}> {
  return request('/synthetic-db/import', { method: 'POST', body: JSON.stringify(payload) });
}

export async function apiGetSyntheticDbSchema(): Promise<{ success: boolean; schema: unknown }> {
  return request('/synthetic-db/schema');
}