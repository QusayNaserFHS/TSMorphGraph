// ── Shared types for TSMorphGraph ────────────────────────────────────

export interface GraphNode {
  id: string;
  name: string;
  filePath: string;
  additions: number;
  deletions: number;
  totalChanges: number;
  status: string;
  fileType: string;
  group: string;
  diffContent?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  violation?: string;      // rule name if this link is a violation
  violationType?: string;  // 'layer' | 'circular' | 'forbidden'
}

export interface ArchRule {
  name: string;
  type: 'layer' | 'forbidden';
  from: string;
  to: string;
  description?: string;
}

export interface ArchRules {
  layers?: string[];
  rules?: Record<string, { canImportFrom: string[] }>;
  forbidden?: Array<{ from: string; to: string; description?: string }>;
  detectCircular?: boolean;
}

export interface GraphData {
  meta: {
    branch: string;
    base: string;
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    generatedAt: string;
    availableBranches?: string[];
    repoPath?: string;
  };
  nodes: GraphNode[];
  links: GraphLink[];
  violations?: GraphLink[];
  archRules?: ArchRules;
}
