import { execSync } from 'child_process';
import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { GraphNode, GraphLink, GraphData, ArchRules } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Public types ────────────────────────────────────────────────────

export interface AnalyzeOptions {
  repo: string;
  base: string;
  branch: string;
  diffContent?: boolean;
  output?: string;
}

// ── Git helpers ─────────────────────────────────────────────────────

export function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

export function detectBaseBranch(repo: string): string {
  const branches = git('branch -a', repo);
  if (branches.includes('main')) return 'main';
  if (branches.includes('master')) return 'master';
  return 'main';
}

export function getBranches(repo: string): string[] {
  const output = git("branch -a --format='%(refname:short)'", repo);
  if (!output) return [];
  return output
    .split('\n')
    .map(b => b.replace(/^'|'$/g, '').trim())
    .filter(Boolean);
}

// ── Diff parsing ────────────────────────────────────────────────────

export function getFileStatuses(repo: string, base: string, branch: string): Map<string, string> {
  const output = git(`diff ${base}...${branch} --name-status`, repo);
  if (!output) return new Map();

  const map = new Map<string, string>();
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0];
    const filePath = parts[parts.length - 1];
    const s = status.startsWith('R') ? 'renamed'
      : status === 'A' ? 'added'
      : status === 'D' ? 'deleted'
      : 'modified';
    map.set(filePath, s);
  }
  return map;
}

export function getNumStat(repo: string, base: string, branch: string): Map<string, { add: number; del: number }> {
  const output = git(`diff ${base}...${branch} --numstat`, repo);
  if (!output) return new Map();

  const map = new Map<string, { add: number; del: number }>();
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const add = parts[0] === '-' ? 0 : parseInt(parts[0]);
    const del = parts[1] === '-' ? 0 : parseInt(parts[1]);
    const filePath = parts.slice(2).join('\t');
    map.set(filePath, { add, del });
  }
  return map;
}

export function getFileDiff(repo: string, base: string, branch: string, filePath: string): string {
  const diff = git(`diff ${base}...${branch} -- "${filePath}"`, repo);
  // Cap at 500 lines to avoid bloat
  const lines = diff.split('\n');
  if (lines.length > 500) {
    return lines.slice(0, 500).join('\n') + '\n... (truncated at 500 lines)';
  }
  return diff;
}

// ── File type detection ─────────────────────────────────────────────

export function detectFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.json': 'json',
    '.css': 'style', '.scss': 'style', '.less': 'style',
    '.html': 'html',
    '.md': 'markdown',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.cs': 'csharp',
    '.sql': 'sql',
  };
  return map[ext] ?? 'other';
}

export function detectGroup(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) return 'root';
  const skip = new Set(['src', 'lib', 'app', 'test', 'tests', '.']);
  for (const part of parts) {
    if (part.includes('.')) break;
    if (!skip.has(part)) return part;
  }
  return parts[0];
}

// ── ts-morph import analysis ────────────────────────────────────────

export function analyzeImports(repo: string, changedFiles: string[]): GraphLink[] {
  const tsFiles = changedFiles.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  if (tsFiles.length === 0) return [];

  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const changedSet = new Set(changedFiles);

  const project = new Project({
    compilerOptions: { allowJs: true, noEmit: true },
    skipAddingFilesFromTsConfig: true,
  });

  for (const f of tsFiles) {
    const fullPath = path.join(repo, f);
    if (fs.existsSync(fullPath)) {
      project.addSourceFileAtPath(fullPath);
    }
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

  for (const sourceFile of project.getSourceFiles()) {
    const fromPath = path.relative(repo, sourceFile.getFilePath());

    for (const imp of sourceFile.getImportDeclarations()) {
      const moduleSpec = imp.getModuleSpecifierValue();
      if (!moduleSpec.startsWith('.')) continue;

      const dir = path.dirname(sourceFile.getFilePath());
      const resolved = path.resolve(dir, moduleSpec);

      for (const ext of extensions) {
        const candidate = path.relative(repo, resolved + ext);
        if (changedSet.has(candidate) && candidate !== fromPath) {
          const key = `${fromPath}->${candidate}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({ source: fromPath, target: candidate });
          }
          break;
        }
      }
    }
  }

  return links;
}

// ── Architecture rules + violation detection ────────────────────────

export function loadArchRules(repo: string): ArchRules | undefined {
  const configPath = path.join(repo, '.tsmorph-rules.json');
  if (!fs.existsSync(configPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return undefined;
  }
}

export function detectViolations(
  links: GraphLink[],
  nodes: GraphNode[],
  rules: ArchRules,
): GraphLink[] {
  const violations: GraphLink[] = [];
  const nodeGroup = new Map<string, string>();
  nodes.forEach(n => nodeGroup.set(n.id, n.group));

  // Layer violations: check if source group is allowed to import from target group
  if (rules.rules) {
    for (const link of links) {
      const srcGroup = nodeGroup.get(link.source);
      const tgtGroup = nodeGroup.get(link.target);
      if (!srcGroup || !tgtGroup || srcGroup === tgtGroup) continue;

      const allowed = rules.rules[srcGroup]?.canImportFrom;
      if (allowed && !allowed.includes(tgtGroup)) {
        violations.push({
          source: link.source,
          target: link.target,
          violation: `${srcGroup} cannot import from ${tgtGroup}`,
          violationType: 'layer',
        });
      }
    }
  }

  // Forbidden imports
  if (rules.forbidden) {
    for (const link of links) {
      const srcGroup = nodeGroup.get(link.source);
      const tgtGroup = nodeGroup.get(link.target);
      for (const f of rules.forbidden) {
        const fromMatch = srcGroup === f.from || link.source.includes(f.from);
        const toMatch = tgtGroup === f.to || link.target.includes(f.to);
        if (fromMatch && toMatch) {
          violations.push({
            source: link.source,
            target: link.target,
            violation: f.description || `Forbidden: ${f.from} -> ${f.to}`,
            violationType: 'forbidden',
          });
        }
      }
    }
  }

  // Circular dependency detection
  if (rules.detectCircular !== false) {
    const adj = new Map<string, Set<string>>();
    for (const link of links) {
      if (!adj.has(link.source)) adj.set(link.source, new Set());
      adj.get(link.source)!.add(link.target);
    }

    // Find cycles using DFS
    const visited = new Set<string>();
    const stack = new Set<string>();

    function dfs(node: string, path: string[]): string[][] {
      const cycles: string[][] = [];
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) cycles.push(path.slice(cycleStart));
        return cycles;
      }
      if (visited.has(node)) return cycles;
      visited.add(node);
      stack.add(node);
      for (const next of adj.get(node) || []) {
        cycles.push(...dfs(next, [...path, node]));
      }
      stack.delete(node);
      return cycles;
    }

    const allNodes = new Set([...adj.keys()]);
    const seenCycleEdges = new Set<string>();
    for (const node of allNodes) {
      visited.clear();
      stack.clear();
      const cycles = dfs(node, []);
      for (const cycle of cycles) {
        for (let i = 0; i < cycle.length; i++) {
          const from = cycle[i];
          const to = cycle[(i + 1) % cycle.length];
          const key = `${from}->${to}`;
          if (seenCycleEdges.has(key)) continue;
          seenCycleEdges.add(key);
          violations.push({
            source: from,
            target: to,
            violation: `Circular: ${cycle.map(c => c.split('/').pop()).join(' -> ')}`,
            violationType: 'circular',
          });
        }
      }
    }
  }

  return violations;
}

// ── Analyze all branches against a base ─────────────────────────────

export function analyzeAllBranches(repo: string, base: string, primaryBranch: string, diffContent: boolean): Record<string, GraphData> {
  const branches = getBranches(repo);
  const results: Record<string, GraphData> = {};

  // Primary branch gets full analysis (with diff content)
  try {
    results[primaryBranch] = analyze({ repo, base, branch: primaryBranch, diffContent });
  } catch {
    // primary branch must work
    throw new Error(`Failed to analyze primary branch: ${primaryBranch}`);
  }

  // Other branches get lightweight analysis (no diff content to keep size down)
  for (const branch of branches) {
    if (branch === primaryBranch || branch === base || results[branch]) continue;
    try {
      const data = analyze({ repo, base, branch, diffContent: false });
      results[branch] = data;
    } catch {
      // Skip branches that fail (e.g. no common ancestor)
    }
  }

  return results;
}

// ── HTML generation ─────────────────────────────────────────────────

export function generateHtml(data: GraphData, allBranchData?: Record<string, GraphData>): string {
  const templatePath = path.join(__dirname, 'template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  // Escape </ sequences to prevent closing the script tag prematurely
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  const allJson = allBranchData
    ? JSON.stringify(allBranchData).replace(/<\//g, '<\\/')
    : '{}';
  // Use replacer functions to avoid $ being interpreted as special replacement patterns
  return template
    .replace('__GRAPH_DATA__', () => json)
    .replace('__ALL_BRANCH_DATA__', () => allJson);
}

// ── Main analyze function ───────────────────────────────────────────

export function analyze(options: AnalyzeOptions): GraphData {
  const { repo, base: baseArg, branch, diffContent } = options;

  if (!fs.existsSync(path.join(repo, '.git'))) {
    throw new Error(`Not a git repository: ${repo}`);
  }

  const base = baseArg === 'main' ? detectBaseBranch(repo) : baseArg;
  const branchName = branch === 'HEAD'
    ? git('rev-parse --abbrev-ref HEAD', repo) || 'HEAD'
    : branch;

  const statuses = getFileStatuses(repo, base, branch);
  const numstat = getNumStat(repo, base, branch);

  if (statuses.size === 0) {
    throw new Error('No changes found. Check that the base branch exists and there are differences.');
  }

  const nodes: GraphNode[] = [];
  const changedFiles: string[] = [];

  for (const [filePath, status] of statuses) {
    const stats = numstat.get(filePath) ?? { add: 0, del: 0 };
    changedFiles.push(filePath);

    const node: GraphNode = {
      id: filePath,
      name: path.basename(filePath),
      filePath,
      additions: stats.add,
      deletions: stats.del,
      totalChanges: stats.add + stats.del,
      status,
      fileType: detectFileType(filePath),
      group: detectGroup(filePath),
    };

    if (diffContent) {
      node.diffContent = getFileDiff(repo, base, branch, filePath);
    }

    nodes.push(node);
  }

  const links = analyzeImports(repo, changedFiles);

  // Gather available branches
  const availableBranches = getBranches(repo);

  // Load architecture rules and detect violations
  const archRules = loadArchRules(repo);
  const violations = archRules ? detectViolations(links, nodes, archRules) : [];

  return {
    meta: {
      branch: branchName,
      base,
      totalFiles: nodes.length,
      totalAdditions: nodes.reduce((s, n) => s + n.additions, 0),
      totalDeletions: nodes.reduce((s, n) => s + n.deletions, 0),
      generatedAt: new Date().toISOString(),
      availableBranches,
      repoPath: repo,
    },
    nodes,
    links,
    violations,
    archRules,
  };
}
