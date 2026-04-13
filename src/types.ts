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
}
