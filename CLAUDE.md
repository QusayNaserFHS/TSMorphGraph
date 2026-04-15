# TSMorphGraph

## Context
Git diff/PR/branch visualizer that analyzes changed files with ts-morph, extracts import relationships, and renders an interactive force-directed graph as a self-contained HTML file. Built with TypeScript (ESM), ts-morph for static analysis, and force-graph (2D canvas) for visualization. Installable as an npm package via `tsmorph-graph` CLI. Integrated into the ADW dashboard (agent_playground) alongside CodeAtlas for C# analysis.

## Tooling
- Runtime: Node.js (ESM, `"type": "module"`)
- Static analysis: ts-morph ^24.0.0 (TypeScript AST — extracts imports between changed files)
- Visualization: force-graph 1.47.3 (loaded from unpkg CDN, d3-force physics)
- Syntax highlighting: highlight.js 11.9.0 (loaded from CDN, used in diff viewer)
- Runner: tsx ^4.19.0 (runs .ts files directly, no build step needed for dev)
- TypeScript: ^5.7.0 (compiles to `dist/` for packaging)
- Workspace: Nx (minimal config — build caching, target orchestration)
- Testing: Playwright (browser-based viewer tests with screenshots)

## Key Commands
- `npm install` — Install dependencies
- `npm run analyze -- --repo <path> --base <branch> --branch <branch>` — Analyze a real git repo diff
- `npm run analyze -- --repo <path> --base <branch> --branch <branch> --diff-content` — Include file diffs in output
- `npm run analyze -- --repo <path> --base <branch> --branch <branch> --diff-content --open` — Start live server with branch switching
- `npm run analyze -- --repo <path> --list-branches` — List available branches as JSON
- `npm run generate` — Generate synthetic test datasets (small/medium/huge/impossible)
- `npm run build` — Compile TypeScript to `dist/` + copy template.html
- `npx playwright test` — Run viewer tests with screenshots

## CLI Flags
- `--repo <path>` — Path to git repository (default: cwd)
- `--base <branch>` — Base branch for diff (default: main)
- `--branch <branch>` — Compare branch (default: HEAD)
- `--diff-content` — Include unified diff content per file in JSON (opt-in, caps at 500 lines/file)
- `--list-branches` — Print available branches as JSON and exit
- `--output <dir>` — Output directory (default: ./output)
- `--open` — Start live server (port 3742) and open browser. Enables branch switching via dropdowns
- `--serve` — Start live server without opening browser
- `--port <number>` — Server port (default: 3742)
- `--no-all-branches` — Skip pre-analyzing all branches (faster, used by dashboard integration)

## Project Structure
- `src/types.ts` — Shared type definitions (GraphNode, GraphLink, GraphData, ArchRules)
- `src/analyze.ts` — Library: git diff parsing, ts-morph import analysis, violation detection, HTML generation
- `src/cli.ts` — CLI entry point (thin wrapper around analyze, becomes `bin` target)
- `src/index.ts` — Public API exports for programmatic use
- `src/template.html` — Force-graph viewer template (split layout, search, filters, diff viewer, violations)
- `src/generate-test-data.ts` — Synthetic dataset generator for stress testing (30–8000 nodes)
- `tests/viewer.spec.ts` — Playwright tests for the HTML viewer
- `tests/clustering.spec.ts` — Playwright tests for clustering feature
- `docs/plans/` — Implementation plans
- `docs/engine-benchmark.md` — ts-morph vs ast-grep benchmark results
- `output/` — Generated files: `graph.json`, `graph.html`, test datasets, screenshots
- `dist/` — Compiled JS output (for npm packaging, includes template.html)
- `nx.json` / `project.json` — Nx workspace configuration

## Development Guidelines
1. The HTML viewer is a **single self-contained file** — force-graph + highlight.js loaded from CDN, graph data injected into `<script id="graph-data">` + `<script id="all-branch-data">` tags
2. All node rendering uses `nodeCanvasObject` — custom Canvas2D drawing, not DOM elements
3. Force simulation config: `d3AlphaDecay(0.05)`, `d3VelocityDecay(0.65)`, `cooldownTime(8000)`, `enableNodeDrag(false)`
4. `Graph.refresh()` does **not exist** in force-graph — use `Graph.d3ReheatSimulation()` for physics reheat
5. **Force canvas repaint**: After changing `highlightNodes`/`highlightLinks` sets, call `Graph.linkColor(Graph.linkColor())` to trigger a repaint. Without this, highlight changes won't be visible until the next zoom/pan
6. Template uses `__GRAPH_DATA__` and `__ALL_BRANCH_DATA__` as placeholder strings replaced at build time
7. **JSON escaping**: When injecting JSON into HTML, escape `</` to `<\/` and use `() => json` as replacer function (avoids `$` special patterns in String.replace)
8. Filter visibility works by rebuilding graphData with filtered nodes/links via `Graph.graphData()`
9. **Build step**: `npm run build` runs `tsc && cp src/template.html dist/template.html` — template must be copied to dist for the packaged CLI to work

## Layout
- **Split layout**: 63% left (graph canvas) / 37% right (detail panel), with resizable drag handle
- **Top toolbar**: Title, branch selectors, file count, stats, Cluster toggle, Violations toggle + count, Spacing slider, Switch to CodeAtlas button, FPS counter
- **Floating bar on graph**: Search input + filter dropdowns (Type, Group, Status) + Connected toggle + Violations Only toggle
- **Right panel**: Empty state when no node selected → File info (collapsible), Connections (collapsible), Violations list, Diff viewer with search + syntax highlighting + line numbers + word-level diffs + collapsible hunks

## Data Shape
The JSON fed to the viewer follows this structure:
- `meta`: `{ branch, base, totalFiles, totalAdditions, totalDeletions, generatedAt, availableBranches?, repoPath? }`
- `nodes[]`: `{ id (filePath), name, filePath, additions, deletions, totalChanges, status, fileType, group, diffContent? }`
- `links[]`: `{ source (filePath), target (filePath), violation?, violationType? }`
- `violations[]`: `{ source, target, violation (description), violationType (layer|circular|forbidden) }`
- `archRules?`: `{ rules?, forbidden?, detectCircular? }` — loaded from `.tsmorph-rules.json`
- Node `status`: `added` | `modified` | `deleted` | `renamed`
- Node `fileType`: `typescript` | `javascript` | `json` | `style` | `html` | `csharp` | `yaml` | `sql` | `markdown` | `other`
- Node `group`: 2-level directory path (e.g., `adws/dashboard`, `adws/workflows`) for granular architecture rules
- Node `diffContent`: unified diff string (optional, present when `--diff-content` flag is used)

## Viewer Features
- **Search**: `Cmd+K` / `Ctrl+K` to focus, floats on graph canvas, substring match on file path/name, arrow keys to navigate, Enter/click flies to node
- **Filters**: Dropdown multiselects for file types, groups/layers, statuses. Connected toggle (hide isolated nodes). Violations Only toggle
- **Clustering**: Toggle to collapse groups into cluster nodes with dashed ring + count. Click cluster to expand. Only expands clicked cluster, not nearby ones
- **Detail panel**: Click a node — right panel shows file info (collapsible), connections (collapsible, clickable to navigate), violations for this node, and diff viewer
- **Diff viewer**: Syntax highlighting (highlight.js), line numbers, word-level diff highlighting (LCS-based), collapsible hunks (folds 8+ context lines), search with prev/next navigation
- **Violations**: Red edges (transparent when unselected, solid when selected node is involved). Toggle on/off. Rules panel shows configured rules + detected violations with checkboxes per type
- **Branch switching**: Dropdown selectors for Base/Compare branches. All branches pre-analyzed and embedded for instant switching. Live server mode (`--open`) for real-time re-analysis
- **Right-click menu**: Focus neighborhood, Copy file path
- **Resizable split**: Drag the border between graph and panel to adjust the 63/37 ratio
- **Spacing slider**: Adjusts repulsion between unconnected groups (charge strength + distanceMax)
- **Escape key**: Deselects node, closes detail panel, exits focus neighborhood, zooms to fit

## Architecture Rules (`.tsmorph-rules.json`)
Place in repo root to enable violation detection:
```json
{
  "rules": {
    "adws/dashboard": { "canImportFrom": ["adws/core", "adws/workflows"] },
    "adws/workflows": { "canImportFrom": ["adws/core"] }
  },
  "forbidden": [
    { "from": ".spec.", "to": "fixtures", "description": "Spec files should use shared fixtures" }
  ],
  "detectCircular": true
}
```
- `rules`: Layer rules — which group can import from which (matched by node `group`)
- `forbidden`: Pattern-based rules — `from`/`to` match against file paths (substring match)
- `detectCircular`: DFS cycle detection on the import graph

## Dashboard Integration (agent_playground)
- Branch: `feat/viz-integration` on `QusayNaserFHS/agent_playground`
- Backend: `adws/dashboard/backend/workflows/visualizers.py` — invokes TSMorphGraph and CodeAtlas CLIs
- Backend: `adws/dashboard/backend/workflows/routes.py` — `/api/workflows/{id}/tsmorph` and `/codeatlas` endpoints
- Frontend: `card-actions.tsx` — TSMorph and CodeAtlas buttons on workflow cards
- Switch buttons: Each visualization has a "Switch to CodeAtlas/TSMorph" button in the toolbar (only visible when served from dashboard)
- CodeAtlas multi-language: Branch `feat/multi-language` on `FoothillSolutions/GitNexus` — MrAnalyzerLite for non-C# projects

## Slash Commands (`.claude/commands/`)
- `/plan <description>` — Create an implementation plan for a task
- `/implement <plan file>` — Execute a plan step-by-step with validation
- `/test` — Run full validation suite (types, analyze, generate, output check)
- `/review <plan file>` — Review work against a plan with Playwright screenshots
- `/commit [type]` — Create a formatted git commit from current changes
- `/prime` — Quick codebase orientation from CLAUDE.md
- `/visualize <repo> [base] [branch]` — Run analyzer and open the force-graph
- `/stress-test` — Generate all datasets and measure FPS per size

## Architecture Notes
- The pipeline is: `git diff` → parse name-status + numstat → ts-morph import analysis → load `.tsmorph-rules.json` → detect violations → build nodes + links + violations → serialize JSON → inject into HTML template → write self-contained output
- Reference project: `../GitNexus-CodeAtlas/tools/CodeAtlas/` — C#/Roslyn backend with dagre layout, now supports multi-language via MrAnalyzerLite
- The viewer is framework-light: vanilla JS in the template, no React/Preact build step
- Package is installable via `npm install tsmorph-graph` — exposes `tsmorph-graph` CLI binary and programmatic API via `src/index.ts`
- ast-grep was benchmarked as alternative engine but ts-morph won on both speed (2.7x faster) and accuracy (see `docs/engine-benchmark.md`)
