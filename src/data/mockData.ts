export type InvestigationStatus = 'active' | 'pending' | 'closed' | 'escalated';

export interface Investigation {
  id: string;
  name: string;
  description: string;
  status: InvestigationStatus;
  confidence: number;
  entityCount: number;
  evidenceCount: number;
  clusterCount: number;
  analyst: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export const investigations: Investigation[] = [
  {
    id: 'inv-001',
    name: 'Operation Nightfall',
    description: 'Evidence suggests potential coordination between financial entities in Eastern Europe and known shell networks. Multiple correlated transactions identified.',
    status: 'active',
    confidence: 87,
    entityCount: 42,
    evidenceCount: 118,
    clusterCount: 7,
    analyst: 'A. Kowalski',
    createdAt: '2026-08-14',
    updatedAt: '2026-09-24',
    tags: ['financial', 'shell-network', 'eastern-europe'],
    priority: 'critical',
  },
  {
    id: 'inv-002',
    name: 'Project Irongate',
    description: 'Network of social media accounts with coordinated inauthentic behavior patterns. Possible state-affiliated amplification campaign targeting infrastructure discourse.',
    status: 'active',
    confidence: 73,
    entityCount: 28,
    evidenceCount: 204,
    clusterCount: 12,
    analyst: 'M. Osei',
    createdAt: '2026-07-29',
    updatedAt: '2026-09-23',
    tags: ['influence-op', 'social-media', 'disinformation'],
    priority: 'high',
  },
  {
    id: 'inv-003',
    name: 'Cascade Analysis — Freight Sector',
    description: 'Anomalous routing patterns across three freight companies potentially indicate supply chain infiltration. Limited evidence at this stage.',
    status: 'pending',
    confidence: 44,
    entityCount: 15,
    evidenceCount: 37,
    clusterCount: 3,
    analyst: 'T. Brennan',
    createdAt: '2026-09-02',
    updatedAt: '2026-09-20',
    tags: ['supply-chain', 'logistics', 'freight'],
    priority: 'medium',
  },
  {
    id: 'inv-004',
    name: 'Meridian Cross-Reference',
    description: 'Cross-referencing offshore entities linked to a procurement tender with prior intelligence holdings. Early-stage review.',
    status: 'pending',
    confidence: 31,
    entityCount: 9,
    evidenceCount: 22,
    clusterCount: 2,
    analyst: 'A. Kowalski',
    createdAt: '2026-09-10',
    updatedAt: '2026-09-18',
    tags: ['offshore', 'procurement', 'cross-ref'],
    priority: 'medium',
  },
  {
    id: 'inv-005',
    name: 'Echo Chamber — Media Network',
    description: 'Closed case. Coordinated narrative amplification confirmed across 6 regional news outlets. Attribution documented, report filed.',
    status: 'closed',
    confidence: 91,
    entityCount: 31,
    evidenceCount: 287,
    clusterCount: 9,
    analyst: 'M. Osei',
    createdAt: '2026-05-11',
    updatedAt: '2026-08-30',
    tags: ['media', 'narrative', 'confirmed'],
    priority: 'high',
  },
  {
    id: 'inv-006',
    name: 'Redline Telecom Probe',
    description: 'Escalated for immediate review. Strong evidence of unauthorized access patterns across telecom infrastructure nodes in three jurisdictions.',
    status: 'escalated',
    confidence: 82,
    entityCount: 19,
    evidenceCount: 96,
    clusterCount: 5,
    analyst: 'T. Brennan',
    createdAt: '2026-09-15',
    updatedAt: '2026-09-25',
    tags: ['telecom', 'infrastructure', 'unauthorized-access'],
    priority: 'critical',
  },
];

export const recentActivity = [
  { id: 1, action: 'New evidence added', subject: 'Operation Nightfall', time: '6m ago', type: 'evidence' },
  { id: 2, action: 'Cluster merged', subject: 'Project Irongate', time: '31m ago', type: 'cluster' },
  { id: 3, action: 'Confidence updated', subject: 'Redline Telecom Probe', time: '1h ago', type: 'score' },
  { id: 4, action: 'New entity linked', subject: 'Operation Nightfall', time: '2h ago', type: 'entity' },
  { id: 5, action: 'Report generated', subject: 'Echo Chamber', time: '3h ago', type: 'report' },
];
