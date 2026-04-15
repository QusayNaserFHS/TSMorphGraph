# Plan: Fix hover and click UX issues

## Issue
bug: Fix hover effects, click reliability, and right panel data display issues

## Context
Testing reveals these UX issues:
1. **Hover highlight still triggers on zoom** — zooming in/out causes nodes to flicker/highlight as the mouse passes over them during pan
2. **Node name shows on hover but shouldn't interfere** — labels already render on canvas, hover name display should be subtle
3. **Click sometimes doesn't register** — hit area was increased but force-graph's internal pointer detection still misses on small nodes at low zoom
4. **Right panel status badge spacing** — "layout.spec.tsmodified" has no visual gap (CSS margin exists but could be clearer)
5. **Diff section header needs file path context** — just says "Diff" with no indication of which file

## Approach
1. Disable hover highlight entirely — only show highlight on click/select
2. Add cursor pointer change on node hover so users know it's clickable
3. Scale hit area with zoom level so small nodes at low zoom still have large click targets
4. Add status badge space separator and file name in diff header
5. Add Playwright tests verifying all interactions work

## Relevant Files
### Modify
- `src/template.html` — Fix hover, click areas, right panel display
- `tests/viewer.spec.ts` — Update tests for new interactions

## Step by Step Tasks

### 1. Remove hover highlight, add cursor change
In `onNodeHover`: don't call `updateHighlight`. Instead just change cursor to pointer when over a node:
```javascript
.onNodeHover(node => {
  hoveredNode = node;
  graphContainer.style.cursor = node ? 'pointer' : 'default';
})
```

### 2. Scale click hit area with zoom
The `nodePointerAreaPaint` draws the invisible click area. At low zoom, nodes are tiny but the hit area should stay large in screen pixels:
```javascript
.nodePointerAreaPaint((node, color, ctx, globalScale) => {
  const baseR = node.__isCluster ? ... : ...;
  const screenR = Math.max(baseR, 12 / globalScale); // at least 12 screen pixels
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(node.x, node.y, screenR, 0, 2 * Math.PI);
  ctx.fill();
})
```

### 3. Fix right panel display details
- Add space before status badge: `escapeHtml(node.name) + ' ' + statusBadge`
- Show file name in diff header: `<span>Diff — filename.ts</span>`
- Show "No violations" text when node has 0 violations (instead of hiding section)

### 4. Update Playwright tests
Update `tests/viewer.spec.ts` to verify:
- Click via search opens detail panel
- Detail panel shows correct file info
- Diff renders with lines
- Background click closes panel
- Escape key closes panel
- Violations section shows when applicable

## Validation
- Hover shows pointer cursor, no dimming/flickering
- Click always opens detail panel (test at various zoom levels)
- Right panel shows correct name, path, status, diff
- Violations section visible on violation nodes
- All Playwright tests pass

## Risks
- `nodePointerAreaPaint` callback signature may not include `globalScale` — need to verify force-graph API
