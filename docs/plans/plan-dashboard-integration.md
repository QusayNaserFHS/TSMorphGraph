# Plan: Integrate TSMorphGraph + CodeAtlas into ADW Dashboard

## Issue
feature: Add "TSMorph" and "CodeAtlas" buttons to ADW dashboard workflow cards that open interactive diff visualizations for each workflow's branch

## Context
The ADW dashboard at `agent_playground` shows workflow cards with action buttons (Run App, Patch, Canvas, Terminal, Diff, Trace). Each workflow has `branch_name`, `base_branch`, and `worktree_path` — exactly what both visualization tools need.

- **TSMorphGraph** (this project): TypeScript + ts-morph → force-graph HTML. CLI: `npx tsmorph-graph --repo <path> --base <base> --branch <branch> --diff-content --open`
- **CodeAtlas** (at `GitNexus/tools/CodeAtlas`): C# + Roslyn → dagre-layout HTML. CLI: `CodeAtlas --mr <branch> --repo <path>`

Both produce self-contained HTML files. The dashboard backend (FastAPI) can invoke them and serve the output.

**Dashboard tech stack:**
- Frontend: React 19 + Vite + TypeScript + Tailwind + shadcn/ui + Zustand
- Backend: FastAPI + WebSocket
- Card actions: `adws/dashboard/frontend/src/features/workflows/components/workflow-card/card-actions.tsx`
- Backend routes: `adws/dashboard/backend/workflows/routes.py`

## Approach
1. Create a new branch `feat/viz-integration` in agent_playground
2. Install TSMorphGraph as an npm dependency and ensure CodeAtlas .NET tool is available
3. Add two backend API endpoints: `/api/workflows/{adw_id}/tsmorph` and `/api/workflows/{adw_id}/codeatlas` that run the tools and serve the resulting HTML
4. Add two buttons ("TSMorph Graph" and "CodeAtlas") to the workflow card actions in the frontend

## Relevant Files

### In agent_playground — Modify
- `package.json` — Add `tsmorph-graph` dependency
- `adws/dashboard/backend/workflows/routes.py` — Add `/tsmorph` and `/codeatlas` API endpoints
- `adws/dashboard/frontend/src/features/workflows/components/workflow-card/card-actions.tsx` — Add TSMorph and CodeAtlas action buttons

### In agent_playground — New Files
- `adws/dashboard/backend/workflows/visualizers.py` — Logic to invoke TSMorphGraph and CodeAtlas CLIs, cache outputs

## Step by Step Tasks

### 1. Create feature branch in agent_playground
```bash
cd /Users/qusaynaser/Desktop/Projects/agent_playground
git checkout master
git checkout -b feat/viz-integration
```

### 2. Install TSMorphGraph
```bash
cd /Users/qusaynaser/Desktop/Projects/agent_playground
npm install /Users/qusaynaser/Desktop/Projects/GitDiffTesting/TSMorphGraph
```
This installs TSMorphGraph locally. The `tsmorph-graph` CLI binary will be available in `node_modules/.bin/`.

### 3. Create visualizers.py backend module
Create `adws/dashboard/backend/workflows/visualizers.py` with two functions:

```python
import subprocess
import os
from pathlib import Path

CACHE_DIR = Path("output-viz")

def run_tsmorph(repo_path: str, base_branch: str, branch: str, adw_id: str) -> Path:
    """Run TSMorphGraph and return path to generated HTML."""
    out_dir = CACHE_DIR / adw_id / "tsmorph"
    out_dir.mkdir(parents=True, exist_ok=True)
    html_path = out_dir / "graph.html"
    
    # Use npx to run the locally installed tsmorph-graph
    subprocess.run([
        "npx", "tsmorph-graph",
        "--repo", repo_path,
        "--base", base_branch,
        "--branch", branch,
        "--diff-content",
        "--output", str(out_dir),
    ], check=True, cwd=os.getcwd())
    
    return html_path

def run_codeatlas(repo_path: str, branch: str, adw_id: str) -> Path:
    """Run CodeAtlas and return path to generated HTML."""
    out_dir = CACHE_DIR / adw_id / "codeatlas"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # CodeAtlas is a .NET tool — find the solution file in the repo
    sln_files = list(Path(repo_path).glob("*.sln"))
    
    codeatlas_path = Path("/Users/qusaynaser/Desktop/Projects/GitDiffTesting/GitNexus-CodeAtlas/tools/CodeAtlas")
    
    cmd = ["dotnet", "run", "--project", str(codeatlas_path)]
    if sln_files:
        cmd.append(str(sln_files[0]))
    cmd.extend(["--mr", branch, "--repo", repo_path])
    
    subprocess.run(cmd, check=True, cwd=str(out_dir))
    
    # Find the generated HTML
    html_files = list(out_dir.glob("*.html"))
    if not html_files:
        # Check default output location
        default_out = Path(repo_path) / "output-codeatlas"
        html_files = list(default_out.glob("*.html"))
    
    return html_files[0] if html_files else None
```

### 4. Add backend API endpoints
In `adws/dashboard/backend/workflows/routes.py`, add:

```python
from fastapi.responses import HTMLResponse, JSONResponse
from .visualizers import run_tsmorph, run_codeatlas

@router.get("/{adw_id}/tsmorph")
async def get_tsmorph(adw_id: str):
    """Generate and serve TSMorphGraph visualization for a workflow."""
    wf = get_workflow(adw_id)  # existing function to fetch workflow
    if not wf:
        return JSONResponse({"error": "Workflow not found"}, 404)
    
    repo_path = wf.worktree_path or os.getcwd()
    base = wf.base_branch or "master"
    branch = wf.branch_name or "HEAD"
    
    try:
        html_path = run_tsmorph(repo_path, base, branch, adw_id)
        return HTMLResponse(html_path.read_text())
    except Exception as e:
        return JSONResponse({"error": str(e)}, 500)

@router.get("/{adw_id}/codeatlas")
async def get_codeatlas(adw_id: str):
    """Generate and serve CodeAtlas visualization for a workflow."""
    wf = get_workflow(adw_id)
    if not wf:
        return JSONResponse({"error": "Workflow not found"}, 404)
    
    repo_path = wf.worktree_path or os.getcwd()
    branch = wf.branch_name or "HEAD"
    
    try:
        html_path = run_codeatlas(repo_path, branch, adw_id)
        if html_path and html_path.exists():
            return HTMLResponse(html_path.read_text())
        return JSONResponse({"error": "No output generated"}, 500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, 500)
```

### 5. Add buttons to the frontend workflow card
In `card-actions.tsx`, add two new action buttons alongside the existing ones (Canvas, Terminal, Diff, etc.):

```tsx
// Import icons
import { GitGraph, Network } from "lucide-react";

// Inside the actions component, add:
<ActionButton
  icon={GitGraph}
  label="TSMorph"
  tooltip="Open TSMorphGraph — force-directed import graph"
  onClick={() => window.open(`/api/workflows/${wf.adw_id}/tsmorph`, '_blank')}
  disabled={!wf.branch_name}
/>

<ActionButton
  icon={Network}
  label="CodeAtlas"
  tooltip="Open CodeAtlas — Roslyn dependency graph"
  onClick={() => window.open(`/api/workflows/${wf.adw_id}/codeatlas`, '_blank')}
  disabled={!wf.branch_name}
/>
```

Buttons are disabled when no branch exists (workflow hasn't started git operations yet).

### 6. Build and test
```bash
# Rebuild the frontend
cd adws/dashboard/frontend
npm run build

# Restart the dashboard
cd /Users/qusaynaser/Desktop/Projects/agent_playground
uv run adw dashboard
```

Test:
- Open dashboard at http://localhost:9000
- Click "TSMorph" on a workflow card with a branch → should open force-graph in new tab
- Click "CodeAtlas" on a workflow card → should open dagre-layout graph in new tab

## Validation
- Dashboard loads without errors
- TSMorph button opens a new tab with the force-directed graph for the workflow's branch diff
- CodeAtlas button opens a new tab with the Roslyn dependency graph
- Buttons are disabled when workflow has no branch
- Existing workflow functionality (launch, stop, resume) is unaffected

## Risks
- **CodeAtlas requires .NET 9+** — may not be installed. Add error handling with a helpful message.
- **TSMorphGraph requires Node.js** — should be available since the dashboard frontend uses it, but verify.
- **Long-running analysis** — for large branches, TSMorphGraph or CodeAtlas may take 10-30s. The endpoint should respond with a loading indicator or run async. For v1, synchronous is fine since the button opens a new tab.
- **Worktree paths** — some workflows may have stale or missing worktrees. Check `worktree_path` exists before running.
- **CodeAtlas only works on C# projects** — the button should be hidden or disabled for non-C# repos. Can check by looking for `.sln` or `.csproj` files.
