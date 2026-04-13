# Plan: Packagable Interactive Diff Graph

## Issue
feature: Transform TSMorphGraph into an installable npm package (via Nx) with search, filtering, branch comparison, and rich node detail panel with diffs

## Context
Today, TSMorphGraph is a standalone project: you run `npm run analyze -- --repo <path> --base <branch> --branch <branch>` and it produces a self-contained `graph.html`. The analyzer (`src/analyze.ts`) parses git diffs, runs ts-morph import analysis, builds a JSON graph, and injects it into `src/template.html`. The viewer is vanilla JS with force-graph (canvas-based), a toolbar, FPS counter, and a basic detail panel showing file name, status, additions/deletions, and connections.

**What's missing:**
1. **Not installable** — Can't `npm install tsmorph-graph` in another project and run it
2. **No search** — No way to find a file and fly the camera to it
3. **No filtering** — Can't filter by file type (TS, JS, JSON, etc.) or by layer/group
4. **No branch comparison** — Can only diff one pair of branches; can't pick two branches/PRs interactively
5. **No real diff in detail panel** — Clicking a node shows metadata but not the actual file diff

## Approach

### Phase 1: Nx Monorepo + Packaging
Convert the project to an Nx workspace with a single publishable library package. The package exposes a CLI binary (`tsmorph-graph`) that consumers install and run. The CLI works exactly like today's `npm run analyze` but is globally/locally installable. Nx gives us build, test, and publish orchestration, plus room to add packages later (e.g., a VS Code extension).

### Phase 2: Interactive Viewer Features
Add search, filtering, branch selector, and diff panel — all in `src/template.html` (keeping the single self-contained file model). The analyzer feeds additional data (file diff content, available branches) into the JSON so the viewer can render them.

### Phase 3: Playwright Verification
Use Playwright to screenshot the viewer after each major feature, confirming the UI works end-to-end.

## Relevant Files

### Modify
- `package.json` — Add `bin` field, build scripts, Nx configuration
- `tsconfig.json` — Add `outDir` for compiled output
- `src/analyze.ts` — Add `--diff-content` flag to include file diffs in JSON; add branch listing; export functions for programmatic use; add shebang for CLI binary
- `src/template.html` — Add search bar, file type filter chips, group/layer filter, branch selector dropdown, enhanced detail panel with diff viewer
- `src/generate-test-data.ts` — Add synthetic diff content to test datasets
- `CLAUDE.md` — Update with new commands, data shape, and architecture notes

### New Files
- `nx.json` — Nx workspace configuration
- `project.json` — Nx project config (build targets, etc.)
- `src/cli.ts` — CLI entry point with argument parsing (thin wrapper around analyze logic)
- `src/index.ts` — Public API exports for programmatic use
- `src/types.ts` — Shared type definitions (GraphNode, GraphLink, GraphData) extracted from analyze.ts
- `tests/viewer.spec.ts` — Playwright tests for the HTML viewer

## Step by Step Tasks

### 1. Extract shared types into `src/types.ts`
Move `GraphNode`, `GraphLink`, `GraphData` interfaces out of `analyze.ts` into a shared `src/types.ts`. Both `analyze.ts` and `generate-test-data.ts` already duplicate these — centralize them. Extend `GraphData` with:
```typescript
interface GraphData {
  meta: {
    branch: string;
    base: string;
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    generatedAt: string;
    availableBranches?: string[];  // NEW: for branch selector
    repoPath?: string;            // NEW: for diff retrieval
  };
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphNode {
  // ...existing fields...
  diffContent?: string;  // NEW: unified diff for this file
}
```

### 2. Refactor `analyze.ts` for library + CLI use
Split `analyze.ts` into:
- **`src/analyze.ts`** — Pure functions: `parseArgs()`, `getFileStatuses()`, `getNumStat()`, `analyzeImports()`, `generateHtml()`, `analyze()` (the main orchestrator). All exported. No top-level side effects.
- **`src/cli.ts`** — The `#!/usr/bin/env node` entry point. Imports `analyze()` from `./analyze.ts`, calls it, writes output, logs to console. This becomes the `bin` target.

Add to the analyzer:
- `--diff-content` flag: when set, run `git diff base...branch -- <file>` for each changed file and attach the unified diff string to the node as `diffContent`.
- `--list-branches` mode: output available local + remote branches as JSON (for the branch selector UI).
- `--output` flag: specify output directory (default: `./output`).
- `--open` flag: auto-open the HTML in the default browser after generation.

### 3. Set up Nx workspace
Initialize Nx in the project:
```bash
npx nx@latest init
```
Configure `project.json` with:
- **build** target: `tsc` compilation to `dist/`
- **analyze** target: runs `tsx src/cli.ts` (dev mode)
- **test** target: Playwright tests

Update `package.json`:
```json
{
  "name": "tsmorph-graph",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "tsmorph-graph": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist/", "src/template.html"],
  "exports": {
    ".": "./dist/index.js"
  }
}
```

Update `tsconfig.json` to emit JS:
```json
{
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "noEmit": false
  }
}
```

### 4. Create `src/index.ts` public API
Export the key functions for programmatic use:
```typescript
export { analyze, type AnalyzeOptions } from './analyze.js';
export type { GraphData, GraphNode, GraphLink } from './types.js';
```
This lets other tools import and run the analysis without the CLI.

### 5. Add search with camera navigation to template
Add a search input to the toolbar in `template.html`:
- **UI**: Text input with magnifying glass icon, positioned in the toolbar. Dropdown shows matching files as you type (fuzzy match on `filePath` and `name`).
- **Behavior**: On selecting a result (click or Enter), call `Graph.centerAt(node.x, node.y, 600)` and `Graph.zoom(3, 600)` to fly to the node. Highlight the node and its connections. Set it as `selectedNode` and open the detail panel.
- **Keyboard shortcut**: `Ctrl+K` / `Cmd+K` to focus the search input. `Escape` to close.
- **Implementation**: Pure vanilla JS, no external search library. Filter `data.nodes` with a simple substring match on `filePath` (case-insensitive). Show top 10 results max.

```javascript
// Pseudo-code for search
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  if (!query) { searchResults.style.display = 'none'; return; }
  const matches = data.nodes
    .filter(n => n.filePath.toLowerCase().includes(query))
    .slice(0, 10);
  renderSearchResults(matches);
});

function navigateToNode(node) {
  selectedNode = node;
  updateHighlight(node);
  showDetail(node);
  Graph.centerAt(node.x, node.y, 600);
  Graph.zoom(3, 600);
}
```

### 6. Add file type and group/layer filters to template
Add filter controls below the toolbar (or as a collapsible sidebar):

**File Type Filter:**
- Row of toggle chips, one per file type present in the data (e.g., `TS`, `JS`, `JSON`, `Style`, `HTML`, `Other`).
- Each chip shows count: `TS (24)`. Clicking toggles visibility.
- When a type is deselected, those nodes become invisible (removed from the graph data or set `node.__hidden = true` and skip in `nodeCanvasObject`).
- "All" / "None" toggle buttons for convenience.

**Group/Layer Filter:**
- Similar row of chips, one per unique `group` value.
- Toggling hides/shows all nodes in that group.

**Implementation approach:**
- Maintain a `Set` of visible file types and visible groups.
- On filter change, update the graph by calling `Graph.graphData()` with a filtered copy, or use `nodeVisibility` callback: `Graph.nodeVisibility(node => visibleTypes.has(node.fileType) && visibleGroups.has(node.group))`.
- Links whose source or target is hidden are automatically hidden by force-graph.

### 7. Add branch/PR comparison selector
This is a two-part feature:

**Part A — Backend (CLI):**
- Add `getBranches(repo)` function that runs `git branch -a --format='%(refname:short)'` and returns the list.
- Add `getPullRequests(repo)` function that runs `gh pr list --json number,title,headRefName,baseRefName --limit 20` (requires `gh` CLI, gracefully degrade if not available).
- Include `availableBranches` and optionally `pullRequests` in `meta` so the viewer can render selectors.

**Part B — Frontend (template):**
- Two dropdown selectors in the toolbar: "Base" and "Compare" (pre-filled from `meta.base` and `meta.branch`).
- Changing these triggers a **re-analysis**: since the HTML is self-contained, the branch selector calls back to the CLI. Two approaches:
  - **Option A (recommended)**: The CLI starts a tiny local HTTP server (`node:http`) that serves the HTML and exposes an API endpoint (`/api/analyze?base=X&branch=Y`) that re-runs analysis and returns JSON. The template fetches from this endpoint when branches change. The server shuts down when the browser tab closes.
  - **Option B (simpler)**: The branch selectors are informational only in the static HTML. For re-analysis, the user re-runs the CLI with different args. The selectors show what was analyzed.
- **Recommended: Start with Option B** for the initial release, then add Option A as a follow-up. The static HTML model is the core value; a live server is an enhancement.

For Option B implementation:
- Show the base and compare branch in styled read-only badges.
- Add a "Re-analyze" button that copies the CLI command to clipboard with the current base/compare values.
- Populate the dropdowns from `meta.availableBranches` so users know what's available.

### 8. Enhanced detail panel with diff viewer
When a node is clicked, the detail panel should show:
- **Header**: File name, full path, status badge (colored)
- **Stats**: Additions, deletions, total changes, file type, group
- **Connections**: List of connected files (clickable — clicking navigates to that node)
- **Diff viewer**: If `diffContent` is present on the node, render it in a styled code block with:
  - Line numbers
  - Green background for additions (`+` lines)
  - Red background for deletions (`-` lines)
  - Grey for context lines
  - Monospace font, horizontal scroll, max-height with scroll
  - Syntax highlighting is NOT needed for v1 — just colored diff lines

```html
<div id="dp-diff" style="display:none">
  <div class="dp-label" style="margin-top:10px">Diff</div>
  <pre id="dp-diff-content" class="diff-viewer"></pre>
</div>
```

CSS for the diff viewer:
```css
.diff-viewer {
  background: #0d1117; border: 1px solid #21262d; border-radius: 6px;
  padding: 8px; font-family: 'SF Mono', Consolas, monospace; font-size: 11px;
  max-height: 300px; overflow: auto; white-space: pre; line-height: 1.5;
  margin-top: 6px;
}
.diff-viewer .diff-add { background: rgba(63,185,80,0.15); color: #3fb950; }
.diff-viewer .diff-del { background: rgba(248,81,73,0.15); color: #f85149; }
.diff-viewer .diff-hunk { color: #8b949e; }
```

### 9. Update `generate-test-data.ts` with diff content
Add synthetic `diffContent` to generated nodes so the diff viewer can be tested without a real repo:
```typescript
function generateFakeDiff(node: GraphNode): string {
  const lines = [];
  lines.push(`diff --git a/${node.filePath} b/${node.filePath}`);
  lines.push(`--- a/${node.filePath}`);
  lines.push(`+++ b/${node.filePath}`);
  lines.push(`@@ -1,${node.deletions + 3} +1,${node.additions + 3} @@`);
  // ... generate realistic-looking diff lines
  return lines.join('\n');
}
```

### 10. Write Playwright tests
Create `tests/viewer.spec.ts` with tests that:
1. Open a generated HTML file (use the `small` dataset)
2. Verify the graph canvas renders (check `#graph canvas` exists)
3. Verify the toolbar shows correct metadata
4. Test search: type a file name, verify results appear, click one, verify camera moves
5. Test filters: click a file type chip, verify nodes are hidden/shown
6. Test node click: click a node, verify detail panel opens with correct data
7. Test diff viewer: verify diff content renders with colored lines
8. Screenshot each state for visual verification

Install Playwright as a dev dependency:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 11. Documentation and CLAUDE.md updates
Update `CLAUDE.md` with:
- New project structure (types.ts, cli.ts, index.ts)
- New CLI flags (`--diff-content`, `--list-branches`, `--output`, `--open`)
- Updated data shape (diffContent, availableBranches)
- New commands (`npm run build`, `npx tsmorph-graph`)
- Nx workspace info

## Implementation Order
1. Types extraction (Step 1) — foundation, no risk
2. Analyze refactor (Step 2) — enables everything else
3. Search (Step 5) — highest user value, independent of packaging
4. Filters (Step 6) — second highest user value
5. Detail panel + diff (Step 8) — completes the viewer experience
6. Test data update (Step 9) — supports testing
7. Nx + packaging (Steps 3, 4) — structural, do after features stabilize
8. Branch selector (Step 7) — Option B is simple; Option A is a follow-up
9. Playwright tests (Step 10) — verify everything
10. Docs (Step 11) — last

## Validation
- `npm run analyze -- --repo ../GitNexus-CodeAtlas --base FETCH_HEAD --branch HEAD --diff-content` produces `graph.html` with all new features
- Search: type a partial file name, camera flies to the node
- Filter: toggle TS off, TS nodes disappear; toggle a group off, group nodes disappear
- Detail panel: click a node, see diff with colored lines
- Branch selector: dropdowns show available branches from meta
- `npx tsmorph-graph --repo . --base main --branch HEAD` works after install
- Playwright tests pass and screenshots look correct
- `npm pack` produces a valid tarball that installs and runs in a fresh project

## Risks
- **Nx overhead**: Nx adds complexity to a simple project. Mitigation: use minimal Nx config (just `nx init`, not a full monorepo scaffold). If Nx feels heavy, a plain `bin` field in `package.json` with `tsc` build works fine — Nx is optional.
- **Diff content bloat**: Including full diffs for 800+ files could make the HTML massive. Mitigation: cap diff content at 500 lines per file; add `--diff-content` as opt-in, not default.
- **Force-graph `nodeVisibility`**: Need to verify this API exists in force-graph 1.47.3. Fallback: filter `graphData` and re-call `Graph.graphData(filtered)`.
- **Branch selector live mode (Option A)**: Starting a local server changes the UX model. Keep this as a v2 enhancement.
- **`gh` CLI dependency for PRs**: Not everyone has it installed. Gracefully degrade — show branches only if `gh` is unavailable.
- **Template size**: Adding search, filters, and diff viewer CSS/JS to the template increases its size. It's still one file, but monitor for maintainability. If it exceeds ~1000 lines, consider splitting the JS into a separate file bundled at build time (but this changes the self-contained model).
