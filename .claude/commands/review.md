---
model_set: medium
---
# Review

Review work done against a plan file to ensure implemented features match requirements. Use Playwright to verify the HTML viewer works correctly.

## Variables

plan_file: $1 (path to plan .md file)

## Instructions

- If `$1` is missing, print this and stop: `Usage: /review <plan file>`
- Read `CLAUDE.md` for project context.
- Read the plan file to understand requirements.
- Run `git diff` to see all changes made.
- Use the playwright-skill to open generated HTML files and verify:
  - The force-graph renders correctly
  - Nodes display with correct colors and labels
  - Links are visible between connected nodes
  - Interaction works (hover, click, drag)
  - FPS counter and frame graph are visible
  - Toolbar shows correct branch info and stats
- Take 1-3 screenshots of critical functionality.
- Issue Severity:
  - `blocker` — feature doesn't work, crashes, or shows wrong data
  - `skippable` — cosmetic issue, non-blocking
  - `tech_debt` — works but should be improved later

## Workflow

1. Read the plan file to understand what was supposed to be implemented.
2. Run `git diff --stat` to see what files changed.
3. Run `npm run analyze -- --repo ../GitNexus-CodeAtlas --base FETCH_HEAD --branch HEAD` to regenerate output.
4. Use playwright-skill to open `output/graph.html` and verify the viewer.
5. Compare implementation against plan requirements.
6. Report findings.

## Report

Return ONLY a JSON object:

```json
{
  "verdict": "pass|fail",
  "plan_file": "<path>",
  "screenshots": ["<path1>", "<path2>"],
  "review_issues": [
    { "description": "...", "severity": "blocker|skippable|tech_debt", "resolution": "..." }
  ],
  "summary": "..."
}
```
