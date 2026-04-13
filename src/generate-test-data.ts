import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { GraphNode, GraphLink, GraphData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Randomness helpers ──────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Realistic project structure ─────────────────────────────────────

const FILE_TYPES = [
  { ext: '.ts', type: 'typescript', weight: 35 },
  { ext: '.tsx', type: 'typescript', weight: 20 },
  { ext: '.js', type: 'javascript', weight: 5 },
  { ext: '.json', type: 'json', weight: 8 },
  { ext: '.css', type: 'style', weight: 6 },
  { ext: '.scss', type: 'style', weight: 4 },
  { ext: '.html', type: 'html', weight: 3 },
  { ext: '.md', type: 'markdown', weight: 4 },
  { ext: '.yaml', type: 'yaml', weight: 3 },
  { ext: '.sql', type: 'sql', weight: 4 },
  { ext: '.cs', type: 'csharp', weight: 5 },
  { ext: '.xml', type: 'other', weight: 3 },
];

const STATUSES = [
  { status: 'added', weight: 30 },
  { status: 'modified', weight: 55 },
  { status: 'deleted', weight: 10 },
  { status: 'renamed', weight: 5 },
];

const PROJECTS = [
  { name: 'api', dirs: ['controllers', 'middleware', 'routes', 'validators', 'handlers'] },
  { name: 'core', dirs: ['services', 'models', 'entities', 'interfaces', 'types', 'utils'] },
  { name: 'data', dirs: ['repositories', 'migrations', 'seeders', 'queries'] },
  { name: 'auth', dirs: ['providers', 'guards', 'strategies', 'tokens'] },
  { name: 'ui', dirs: ['components', 'pages', 'hooks', 'stores', 'styles', 'layouts'] },
  { name: 'shared', dirs: ['constants', 'helpers', 'config', 'errors'] },
  { name: 'jobs', dirs: ['workers', 'schedulers', 'processors', 'queues'] },
  { name: 'events', dirs: ['handlers', 'emitters', 'listeners', 'schemas'] },
  { name: 'infra', dirs: ['docker', 'terraform', 'scripts', 'monitoring'] },
  { name: 'tests', dirs: ['unit', 'integration', 'e2e', 'fixtures', 'mocks'] },
];

const NOUNS = [
  'User', 'Order', 'Product', 'Payment', 'Invoice', 'Cart', 'Session',
  'Account', 'Profile', 'Notification', 'Message', 'Comment', 'Report',
  'Dashboard', 'Analytics', 'Search', 'Config', 'Cache', 'Queue', 'Job',
  'Webhook', 'Email', 'Auth', 'Token', 'Permission', 'Role', 'Team',
  'Project', 'Task', 'Event', 'Log', 'Metric', 'Alert', 'Setting',
  'Upload', 'Export', 'Import', 'Sync', 'Backup', 'Health', 'Status',
  'Workflow', 'Template', 'Schema', 'Migration', 'Seed', 'Feature',
  'Billing', 'Subscription', 'Plan', 'Coupon', 'Refund', 'Payout',
  'Inventory', 'Shipping', 'Address', 'Customer', 'Vendor', 'Category',
];

const SUFFIXES: Record<string, string[]> = {
  'controllers': ['Controller', 'Handler'],
  'middleware': ['Middleware', 'Guard'],
  'routes': ['Routes', 'Router'],
  'validators': ['Validator', 'Schema'],
  'handlers': ['Handler', 'Processor'],
  'services': ['Service', 'Manager'],
  'models': ['Model', 'Entity'],
  'entities': ['Entity', 'Aggregate'],
  'interfaces': ['Interface', 'Contract'],
  'types': ['Types', 'Enums'],
  'utils': ['Utils', 'Helpers'],
  'repositories': ['Repository', 'Store'],
  'migrations': ['Migration', ''],
  'seeders': ['Seeder', ''],
  'queries': ['Query', 'Resolver'],
  'providers': ['Provider', 'Strategy'],
  'guards': ['Guard', 'Check'],
  'strategies': ['Strategy', 'Flow'],
  'tokens': ['Token', 'Jwt'],
  'components': ['Component', 'Widget'],
  'pages': ['Page', 'View'],
  'hooks': ['Hook', ''],
  'stores': ['Store', 'State'],
  'styles': ['Styles', 'Theme'],
  'layouts': ['Layout', 'Shell'],
  'constants': ['Constants', 'Config'],
  'helpers': ['Helper', 'Util'],
  'config': ['Config', 'Options'],
  'errors': ['Error', 'Exception'],
  'workers': ['Worker', 'Consumer'],
  'schedulers': ['Scheduler', 'Cron'],
  'processors': ['Processor', 'Pipeline'],
  'queues': ['Queue', 'Channel'],
  'emitters': ['Emitter', 'Publisher'],
  'listeners': ['Listener', 'Subscriber'],
  'schemas': ['Schema', 'Dto'],
  'docker': ['Dockerfile', ''],
  'terraform': ['Main', 'Variables'],
  'scripts': ['Script', 'Setup'],
  'monitoring': ['Dashboard', 'Alert'],
  'unit': ['Test', 'Spec'],
  'integration': ['Integration', 'E2e'],
  'e2e': ['E2e', 'Scenario'],
  'fixtures': ['Fixture', 'Factory'],
  'mocks': ['Mock', 'Stub'],
};

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ── Synthetic diff generator ────────────────────────────────────────

const CODE_SNIPPETS = [
  'import { Injectable } from "@nestjs/common";',
  'export class %NAME% {',
  '  private readonly logger = new Logger(%NAME%.name);',
  '  constructor(private readonly service: %NAME%Service) {}',
  '  async findAll(): Promise<%NAME%[]> {',
  '    return this.repository.find();',
  '  }',
  '  async create(dto: Create%NAME%Dto): Promise<%NAME%> {',
  '    const entity = this.repository.create(dto);',
  '    return this.repository.save(entity);',
  '  }',
  '  async update(id: string, dto: Update%NAME%Dto): Promise<%NAME%> {',
  '    await this.repository.update(id, dto);',
  '    return this.findOne(id);',
  '  }',
  '  async delete(id: string): Promise<void> {',
  '    await this.repository.delete(id);',
  '  }',
  '  @Get()',
  '  @Post()',
  '  @Put(":id")',
  '  @Delete(":id")',
  '  validate(input: unknown): boolean {',
  '    if (!input) throw new BadRequestException();',
  '    return schema.parse(input);',
  '  }',
  '  const result = await fetch(url, { method: "POST", body: JSON.stringify(data) });',
  '  if (!result.ok) throw new Error(`HTTP ${result.status}`);',
  '  return result.json();',
];

function generateFakeDiff(node: GraphNode): string {
  const noun = node.name.replace(/\.[^.]+$/, '').replace(/(Service|Controller|Model|Handler)$/, '') || 'Entity';
  const lines: string[] = [];

  lines.push(`diff --git a/${node.filePath} b/${node.filePath}`);
  if (node.status === 'added') {
    lines.push('new file mode 100644');
    lines.push(`--- /dev/null`);
  } else {
    lines.push(`--- a/${node.filePath}`);
  }
  if (node.status === 'deleted') {
    lines.push(`+++ /dev/null`);
  } else {
    lines.push(`+++ b/${node.filePath}`);
  }

  const contextCount = rand(2, 5);
  const addCount = Math.min(node.additions, 20);
  const delCount = Math.min(node.deletions, 15);
  lines.push(`@@ -1,${delCount + contextCount} +1,${addCount + contextCount} @@`);

  // Context lines
  for (let i = 0; i < contextCount; i++) {
    const snippet = pick(CODE_SNIPPETS).replace(/%NAME%/g, noun);
    lines.push(' ' + snippet);
  }

  // Deletions
  for (let i = 0; i < delCount; i++) {
    const snippet = pick(CODE_SNIPPETS).replace(/%NAME%/g, noun);
    lines.push('-' + snippet);
  }

  // Additions
  for (let i = 0; i < addCount; i++) {
    const snippet = pick(CODE_SNIPPETS).replace(/%NAME%/g, noun);
    lines.push('+' + snippet);
  }

  // Trailing context
  for (let i = 0; i < rand(1, 3); i++) {
    const snippet = pick(CODE_SNIPPETS).replace(/%NAME%/g, noun);
    lines.push(' ' + snippet);
  }

  return lines.join('\n');
}

// ── Generator ───────────────────────────────────────────────────────

function generateDataset(fileCount: number, branchName: string): GraphData {
  const nodes: GraphNode[] = [];
  const usedNames = new Set<string>();

  const projectCount = Math.min(PROJECTS.length, Math.max(2, Math.ceil(fileCount / 15)));
  const activeProjects = PROJECTS.slice(0, projectCount);

  for (let i = 0; i < fileCount; i++) {
    const project = pick(activeProjects);
    const dir = pick(project.dirs);
    const ft = weightedPick(FILE_TYPES);
    const st = weightedPick(STATUSES);

    let name: string;
    let attempts = 0;
    do {
      const noun = pick(NOUNS);
      const suffix = pick(SUFFIXES[dir] || ['']);
      name = noun + suffix + ft.ext;
      attempts++;
      if (attempts > 50) name = noun + suffix + rand(1, 999) + ft.ext;
    } while (usedNames.has(name));
    usedNames.add(name);

    const filePath = `src/${project.name}/${dir}/${name}`;
    const additions = st.status === 'deleted' ? 0 : rand(1, 400);
    const deletions = st.status === 'added' ? 0 : rand(0, 200);

    const node: GraphNode = {
      id: filePath,
      name,
      filePath,
      additions,
      deletions,
      totalChanges: additions + deletions,
      status: st.status,
      fileType: ft.type,
      group: project.name,
    };

    // Add diff content to smaller datasets (avoid bloat on huge ones)
    if (fileCount <= 200) {
      node.diffContent = generateFakeDiff(node);
    }

    nodes.push(node);
  }

  // Generate links
  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const tsNodes = nodes.filter(n => n.fileType === 'typescript' || n.fileType === 'javascript');

  const byGroup = new Map<string, GraphNode[]>();
  for (const n of tsNodes) {
    if (!byGroup.has(n.group)) byGroup.set(n.group, []);
    byGroup.get(n.group)!.push(n);
  }

  for (const [, groupNodes] of byGroup) {
    for (const node of groupNodes) {
      const count = rand(1, Math.min(3, groupNodes.length - 1));
      for (let i = 0; i < count; i++) {
        const target = pick(groupNodes);
        if (target.id === node.id) continue;
        const key = `${node.id}->${target.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ source: node.id, target: target.id });
      }
    }
  }

  const crossLinkCount = Math.floor(fileCount * 0.15);
  for (let i = 0; i < crossLinkCount; i++) {
    if (tsNodes.length < 2) break;
    const from = pick(tsNodes);
    const to = pick(tsNodes);
    if (from.id === to.id || from.group === to.group) continue;
    const key = `${from.id}->${to.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: from.id, target: to.id });
  }

  const groups = [...new Set(nodes.map(n => n.group))];

  return {
    meta: {
      branch: branchName,
      base: 'main',
      totalFiles: nodes.length,
      totalAdditions: nodes.reduce((s, n) => s + n.additions, 0),
      totalDeletions: nodes.reduce((s, n) => s + n.deletions, 0),
      generatedAt: new Date().toISOString(),
      availableBranches: ['main', 'develop', branchName, 'feature/login', 'fix/perf-issue', 'release/v2.0'],
    },
    nodes,
    links,
  };
}

// ── HTML generation ─────────────────────────────────────────────────

function generateHtml(data: GraphData): string {
  const templatePath = path.join(__dirname, 'template.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return template.replace('__GRAPH_DATA__', () => json);
}

// ── Main ────────────────────────────────────────────────────────────

const outDir = path.join(process.cwd(), 'output');
fs.mkdirSync(outDir, { recursive: true });

const datasets = [
  { name: 'small', files: 30, branch: 'feature/auth-refactor' },
  { name: 'medium', files: 150, branch: 'feature/payment-system' },
  { name: 'huge', files: 800, branch: 'release/v3.0-migration' },
  { name: 'impossible', files: 8000, branch: 'release/v4.0-full-rewrite' },
];

for (const ds of datasets) {
  console.log(`Generating ${ds.name}: ${ds.files} files...`);
  const data = generateDataset(ds.files, ds.branch);
  console.log(`  ${data.nodes.length} nodes, ${data.links.length} links`);

  fs.writeFileSync(path.join(outDir, `${ds.name}.json`), JSON.stringify(data, null, 2));
  fs.writeFileSync(path.join(outDir, `${ds.name}.html`), generateHtml(data));
  console.log(`  Written: output/${ds.name}.json + output/${ds.name}.html`);
}

console.log('\nDone!');
