# Import Analysis Engine Benchmark

Tested 2026-04-14 — ts-morph vs ast-grep (@ast-grep/napi) for extracting import relationships between changed files.

## Results (3 runs each, averaged)

| Repo | Files | ts-morph Links | ts-morph Avg | ast-grep Links | ast-grep Avg | Winner |
|------|-------|----------------|--------------|----------------|--------------|--------|
| agent_playground | 734 | 276 | 439ms | 275 | 1193ms | ts-morph 2.7x faster |
| FTS-MCP-Server | 85 | 42 | 60ms | 31 | 60ms | Tie (ts-morph more accurate) |
| GitNexus | 60 | 78 | 96ms | 72 | 143ms | ts-morph 1.5x faster |
| talents | 52 | 4 | 80ms | 4 | 75ms | Tie |

## Conclusion

**ts-morph wins on both speed and accuracy.** Kept as the only engine.

- **Speed**: ts-morph loads all files into one TS compiler Project at once; ast-grep reads and parses each file individually from disk. Batch loading wins at scale.
- **Accuracy**: ts-morph resolves module paths through the TypeScript compiler, catching re-exports, barrel files, and complex import forms. ast-grep uses pattern matching (`import $A from $MODULE`) which misses some edge cases.
- **ast-grep strengths** (not applicable here): better for structural search/replace and linting across languages. Not a fit for import graph extraction where TS-aware resolution matters.

ast-grep engine removed after this benchmark. See git history for the implementation if needed.
