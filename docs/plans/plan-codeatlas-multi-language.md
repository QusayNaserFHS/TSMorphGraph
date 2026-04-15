# Plan: Make CodeAtlas work on Python/TypeScript projects

## Issue
feature: Modify CodeAtlas to support any language (Python, TypeScript, etc.) by skipping Roslyn C#-specific analysis and using the generic diff visualization pipeline

## Context
CodeAtlas at `GitNexus-CodeAtlas/tools/CodeAtlas/` is a C# tool that analyzes git diffs and renders an interactive dagre-layout graph. Currently it requires a `.sln` file and uses Roslyn to analyze C# code for dependency injection and method calls.

However, most of CodeAtlas is actually language-agnostic:
- **DiffParser.cs** — parses unified diffs (any language) ✅
- **MrHtmlRenderer.cs** — generates self-contained HTML (generic) ✅
- **canvas-ui frontend** — renders nodes + diffs with syntax highlighting (already supports JS, JSON, YAML, SQL) ✅
- **MrAnalyzer.cs** — the only C#-locked part. Lines 45-57 filter to `.cs` files and run Roslyn analysis

The `agent_playground` project is Python/TypeScript. To make CodeAtlas work on it, we skip the Roslyn analysis path and process all files through the generic diff path that already exists (lines 60-99 of MrAnalyzer.cs).

## Approach
1. Create a new branch in the GitNexus-CodeAtlas repo
2. Make `.sln` optional — if no solution found, skip Roslyn entirely
3. Process ALL changed files through the generic diff node builder (not just non-C# files)
4. Add Python and TypeScript syntax tokenizers to the canvas-ui frontend
5. Add basic import-based edge detection for Python/TypeScript (regex, no semantic analysis)

## Relevant Files

### In GitNexus-CodeAtlas — Modify
- `tools/CodeAtlas/Program.cs` — Make .sln optional, add `--no-roslyn` flag
- `tools/CodeAtlas/MrAnalyzer.cs` — Skip Roslyn when no .sln or `--no-roslyn`, process all files generically
- `tools/CodeAtlas/DiffParser.cs` — Add file type detection for Python/TS/etc
- `tools/CodeAtlas/canvas-ui/src/syntax/highlighter.ts` — Add Python tokenizer

## Step by Step Tasks

### 1. Create feature branch
```bash
cd /Users/qusaynaser/Desktop/Projects/GitDiffTesting/GitNexus-CodeAtlas
git checkout code-atlas-csharp
git checkout -b feat/multi-language
```

### 2. Make .sln optional in Program.cs
Currently Program.cs searches for a `.sln` and exits if not found. Change it to:
- If `.sln` found → use Roslyn analysis (current behavior)
- If no `.sln` → set a `noRoslyn = true` flag and proceed with diff-only mode

```csharp
// In Program.cs, after solution search:
string? solutionPath = FindSolution(repoPath);
bool noRoslyn = solutionPath == null;

if (noRoslyn)
    Console.WriteLine("No .sln found — running in diff-only mode (no semantic analysis)");
```

### 3. Add generic file processing to MrAnalyzer.cs
In `AnalyzeAsync()`, the current flow is:
1. Get diff files
2. Filter to `.cs` files → run Roslyn analysis → create rich nodes
3. Non-`.cs` files → create basic nodes with diffs only

Change to:
1. Get diff files
2. If `noRoslyn` → process ALL files through the generic path (step 3)
3. If Roslyn available → process `.cs` files through Roslyn, rest through generic path

The generic path (already exists at lines 60-99) creates `MrFileNode` with:
- fileName, filePath, additions, deletions
- DiffType (Added/Modified/Deleted)
- Code sections with line-by-line diffs

Also add lightweight import detection for Python/TypeScript:
```csharp
// For Python files:
// Regex: ^(from\s+(\S+)\s+import|import\s+(\S+))
// For TypeScript/JavaScript files:
// Regex: ^import\s+.*from\s+['"]([^'"]+)['"]
// Match import targets to other changed files → create edges
```

### 4. Add file type detection to DiffParser.cs
Extend the `DiffFile` class:
```csharp
public string FileType => Path.GetExtension(FilePath).ToLower() switch
{
    ".cs" => "csharp",
    ".py" => "python",
    ".ts" or ".tsx" => "typescript",
    ".js" or ".jsx" => "javascript",
    ".json" => "json",
    ".yaml" or ".yml" => "yaml",
    ".css" or ".scss" => "css",
    ".html" => "html",
    ".sql" => "sql",
    ".md" => "markdown",
    _ => "plain"
};
```

### 5. Add Python tokenizer to canvas-ui highlighter.ts
The frontend already has tokenizers for C#, JS, JSON, YAML, SQL. Add Python:
```typescript
function tokenizePython(line: string): Token[] {
  // Keywords: def, class, if, elif, else, for, while, return, import, from, with, as, try, except, finally, raise, yield, async, await, None, True, False
  // Decorators: @something
  // Strings: 'single', "double", '''triple''', """triple"""
  // Comments: # comment
  // Types: int, str, float, list, dict, tuple, set, bool, Optional, Union
}
```

Also map `fileType: "python"` and `fileType: "typescript"` to the correct tokenizer in the `highlightLine()` function.

### 6. Update visualizers.py in agent_playground
Update the CodeAtlas invocation to NOT require a .sln:
```python
# Remove the sln_path logic — CodeAtlas now handles missing .sln gracefully
cmd = [dotnet, "run", "--project", str(codeatlas_path), "--mr", mr_name, "--repo", repo_path]
```

Remove the `_diff_has_extension` check for `.cs` files and the `_create_filtered_sln` function — no longer needed since CodeAtlas works on any language.

## Validation
- Run CodeAtlas on agent_playground (Python project) → should produce HTML with file nodes + diffs
- Run CodeAtlas on a C# project → should still work with full Roslyn analysis
- Open the HTML output → file cards show syntax-highlighted Python/TypeScript code
- Import-based edges connect related files

## Risks
- **Roslyn still loaded when not needed** — the .NET build may still try to load Roslyn packages. Mitigate by making the Roslyn analysis a conditional code path that doesn't crash.
- **Import edge detection is regex-based** — less accurate than Roslyn semantic analysis, but good enough for visualization. Same approach TSMorphGraph uses via ts-morph.
- **Large diffs** — without Roslyn filtering, all changed files create nodes. For branches with 200+ files this could produce large graphs. The dagre layout handles this but may be slow.
