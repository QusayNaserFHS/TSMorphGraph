---
model_set: medium
---
# Stress Test

Generate all test datasets and verify performance using Playwright to check FPS.

## Instructions

- Generate all datasets with `npm run generate`.
- Use playwright-skill to open each HTML file and measure FPS from the frame counter.
- Report performance for each dataset size.

## Workflow

1. Run `npm run generate` to create all test datasets.
2. For each dataset (small, medium, huge, impossible):
   - Open the HTML file with playwright-skill.
   - Wait 5 seconds for simulation to settle.
   - Read the FPS counter value from the toolbar.
   - Take a screenshot.
3. Report results.

## Report

Return a JSON object:

```json
{
  "results": [
    { "dataset": "small", "nodes": 30, "links": 29, "fps": 60, "screenshot": "/tmp/..." },
    { "dataset": "medium", "nodes": 150, "links": 159, "fps": 58, "screenshot": "/tmp/..." },
    { "dataset": "huge", "nodes": 800, "links": 999, "fps": 45, "screenshot": "/tmp/..." },
    { "dataset": "impossible", "nodes": 8000, "links": 10773, "fps": 12, "screenshot": "/tmp/..." }
  ]
}
```
