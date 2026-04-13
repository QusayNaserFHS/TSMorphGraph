# TSMorphGraph

## Context
Git diff/PR/branch visualizer that analyzes changed files with ts-morph, extracts import relationships, and renders an interactive force-directed graph as a self-contained HTML file. Built with TypeScript (ESM), ts-morph for static analysis, and force-graph (2D canvas) for visualization. Installable as an npm package via `tsmorph-graph` CLI.

## Tooling
- Runtime: Node.js (ESM, `"type": "module"`)
- Static analysis: ts-morph ^24.0.0 (TypeScript AST — extracts imports between changed files)
- Visualization: force-graph 1.47.3 (loaded from unpkg CDN, d3-force physics)
- Runner: tsx ^4.19.0 (runs .ts files directly, no build step needed for dev)
- TypeScript: ^5.7.0 (compiles to `dist/` for packaging)
- Workspace: Nx (minimal config — build caching, target orchestration)
- Testing: Playwright (browser-based viewer tests with screenshots)

## Key Commands
- `npm install` — Install dependencies
- `npm run analyze -- --repo <path> --base <branch> --branch <branch>` — Analyze a real git repo diff
- `npm run analyze -- --repo <path> --base <branch> --branch <branch> --diff-content` — Include file diffs in output
- `npm run analyze -- --repo <path> --list-branches` — List available branches as JSON
- `npm run analyze -- --repo ../GitNexus-CodeAtlas --base FETCH_HEAD --branch HEAD` — Test against reference repo
- `npm run generate` — Generate synthetic test datasets (small/medium/huge/impossible)
- `npm run build` — Compile TypeScript to `dist/` for packaging
- `npx playwright test` — Run viewer tests with screenshots

## CLI Flags
- `--repo <path>` — Path to git repository (default: cwd)
- `--base <branch>` — Base branch for diff (default: main)
- `--branch <branch>` — Compare branch (default: HEAD)
- `--diff-content` — Include unified diff content per file in JSON (opt-in, caps at 500 lines/file)
- `--list-branches` — Print available branches as JSON and exit
- `--output <dir>` — Output directory (default: ./output)
- `--open` — Auto-open HTML in default browser after generation

## Project Structure
- `src/types.ts` — Shared type definitions (GraphNode, GraphLink, GraphData)
- `src/analyze.ts` — Library: git diff parsing, ts-morph import analysis, HTML generation (all exported)
- `src/cli.ts` — CLI entry point (thin wrapper around analyze, becomes `bin` target)
- `src/index.ts` — Public API exports for programmatic use
- `src/template.html` — Force-graph viewer template with search, filters, detail panel, diff viewer
- `src/generate-test-data.ts` — Synthetic dataset generator for stress testing (30–8000 nodes)
- `tests/viewer.spec.ts` — Playwright tests for the HTML viewer
- `output/` — Generated files: `graph.json`, `graph.html`, test datasets, screenshots
- `dist/` — Compiled JS output (for npm packaging)
- `nx.json` / `project.json` — Nx workspace configuration

## Development Guidelines
1. The HTML viewer is a **single self-contained file** — force-graph is loaded from CDN, graph data is injected into a `<script id="graph-data">` tag via string replacement
2. All node rendering uses `nodeCanvasObject` — custom Canvas2D drawing, not DOM elements
3. Force simulation config: `d3AlphaDecay(0.05)`, `d3VelocityDecay(0.65)`, `cooldownTime(8000)` — nodes settle in ~5-8s, `d3ReheatSimulation()` on interaction to keep it responsive
4. `Graph.refresh()` does **not exist** in force-graph — use `Graph.d3ReheatSimulation()` instead
5. Template uses `__GRAPH_DATA__` as the placeholder string replaced at build time
6. **JSON escaping**: When injecting JSON into HTML, escape `</` to `<\/` to prevent premature script tag closure (especially with diff content)
7. Filter visibility works by rebuilding graphData with filtered nodes/links via `Graph.graphData()`

## Data Shape
The JSON fed to the viewer follows this structure:
- `meta`: `{ branch, base, totalFiles, totalAdditions, totalDeletions, generatedAt, availableBranches?, repoPath? }`
- `nodes[]`: `{ id (filePath), name, filePath, additions, deletions, totalChanges, status, fileType, group, diffContent? }`
- `links[]`: `{ source (filePath), target (filePath) }`
- Node `status`: `added` | `modified` | `deleted` | `renamed`
- Node `fileType`: `typescript` | `javascript` | `json` | `style` | `html` | `csharp` | `yaml` | `sql` | `markdown` | `other`
- Node `group`: first meaningful directory segment (used for clustering)
- Node `diffContent`: unified diff string (optional, present when `--diff-content` flag is used)

## Viewer Features
- **Search**: `Cmd+K` / `Ctrl+K` to focus, substring match on file path/name, arrow keys to navigate results, Enter/click to fly to node
- **Filters**: Toggle chips for file types, groups/layers, and statuses. All/None buttons for batch toggling
- **Detail panel**: Click a node to see file info, status badge, stats, clickable connections, and collapsible diff viewer
- **Diff viewer**: Colored line-by-line diff (green=add, red=del, grey=context, purple=hunk headers)

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
- The pipeline is: `git diff` → parse name-status + numstat → ts-morph import analysis on .ts/.tsx/.js/.jsx files → build nodes + links → serialize JSON → inject into HTML template → write self-contained output
- Reference project: `../GitNexus-CodeAtlas/tools/CodeAtlas/` — similar pipeline but C#/Roslyn backend with dagre layout + custom canvas rendering
- The viewer is intentionally framework-light: vanilla JS in the template, no React/Preact build step
- Package is installable via `npm install tsmorph-graph` — exposes `tsmorph-graph` CLI binary and programmatic API via `src/index.ts`
