# Plan: Split Layout — Graph Canvas + Side Panel

## Issue
feature: Redesign the UI to a 63/37 split layout — graph canvas on the left, persistent side panel on the right for diff viewer, file details, and FPS counter

## Context
Today the viewer is full-width: the force-graph canvas takes the entire screen below the toolbar/filter bar. The detail panel and FPS counter float as overlays on top of the graph (positioned `fixed`, right-aligned). Clicking a node opens a small floating detail panel; the diff viewer is a collapsible section inside it with a 300px max-height. The FPS counter floats in the top-right corner.

This layout wastes screen real estate — the diff viewer is cramped, the detail panel obscures the graph, and there's no persistent space for file information. The user wants a proper split layout like an IDE: graph on the left (63%), side panel on the right (37%) for all detail/diff/stats content.

## Approach
Convert the layout to a horizontal split: a left pane (63% width) for the graph canvas + tooltip, and a right pane (37% width) for the side panel containing file details, diff viewer (now full-height, always visible when a node is selected), FPS counter, and summary statistics. The toolbar and filter bar stay full-width on top. The side panel is always visible — it shows a placeholder when no node is selected, and fills with content on node click.

## Relevant Files
### Modify
- `src/template.html` — All changes are in this single file (CSS layout, HTML structure, JS wiring)

## Step by Step Tasks

### 1. Restructure the HTML layout
Replace the current flat body structure with a split container below the filter bar:

```html
<div id="main-container">
  <!-- Left: Graph (63%) -->
  <div id="left-pane">
    <div id="graph"></div>
  </div>

  <!-- Right: Side panel (37%) -->
  <div id="right-pane">
    <!-- FPS counter at top -->
    <div id="frame-graph">...</div>

    <!-- Summary stats -->
    <div id="summary-stats">...</div>

    <!-- File detail (shown when node selected) -->
    <div id="detail-panel">
      <h3 id="dp-name"></h3>
      <div class="dp-path" id="dp-path"></div>
      <!-- ... status, additions, deletions, type, group rows ... -->
      <div class="dp-connections">...</div>
      <!-- Diff viewer — no longer collapsible, always visible when diff exists -->
      <div class="diff-viewer" id="dp-diff-content"></div>
    </div>

    <!-- Empty state (shown when no node selected) -->
    <div id="empty-state">
      <p>Click a node to view file details and diff</p>
    </div>
  </div>
</div>
```

### 2. Update CSS for split layout
Replace the current absolute/fixed positioning with a flexbox split:

```css
#main-container {
  position: fixed; top: 74px; left: 0; right: 0; bottom: 0;
  display: flex;
}

#left-pane {
  width: 63%; height: 100%; position: relative; overflow: hidden;
}

#graph {
  width: 100%; height: 100%;
}

#right-pane {
  width: 37%; height: 100%;
  background: #161b22; border-left: 1px solid #30363d;
  overflow-y: auto; padding: 12px;
  display: flex; flex-direction: column; gap: 12px;
}
```

Key CSS changes:
- `#graph` — no longer `position: absolute; top: 74px; left: 0; right: 0; bottom: 0`. Now inside left-pane, takes 100% of its parent.
- `#frame-graph` — no longer `position: fixed`. Now a normal flow element at the top of the right pane.
- `#detail-panel` — no longer `position: fixed; right: 16px; top: 140px; width: 340px; display: none`. Now a normal flow element in the right pane. Its `display` toggles between `block`/`none` based on selection, but it's inline in the panel, not floating.
- `#tooltip` — stays `position: fixed` since it follows the mouse.
- `.diff-viewer` — remove `max-height: 300px`. Let it fill available space with `flex: 1; overflow: auto`.
- Remove the `.dp-diff-toggle` button — diff is always visible when content exists, no toggle needed.
- Remove `.dp-close` button — deselecting is done by clicking background, not a close button on the panel.

### 3. Add summary statistics section
Add a summary block at the top of the right pane (below FPS) showing:
- Total files, additions, deletions (from meta)
- File type breakdown (mini bar chart or counts)
- Group breakdown

This gives the right pane content even when no node is selected.

```html
<div id="summary-stats">
  <div class="stats-header">Summary</div>
  <div class="stats-row"><span>Files</span><span id="sp-files"></span></div>
  <div class="stats-row"><span>Additions</span><span class="add" id="sp-add"></span></div>
  <div class="stats-row"><span>Deletions</span><span class="del" id="sp-del"></span></div>
  <div class="stats-types" id="sp-types"></div>
</div>
```

### 4. Update empty state
When no node is selected, show a centered message in the detail area:

```html
<div id="empty-state">
  <div style="color:#484f58;text-align:center;padding:40px 20px">
    <div style="font-size:24px;margin-bottom:8px">&#x1F50D;</div>
    <div>Click a node or search (Cmd+K) to view file details</div>
  </div>
</div>
```

### 5. Update JS — force-graph sizing
Force-graph auto-detects its container size, but since we're changing the container from full-screen to 63% width, we need to ensure the graph resizes correctly:

- The graph container `#graph` is now inside `#left-pane` which is 63% width
- Force-graph should auto-detect this from the container's `clientWidth`/`clientHeight`
- Call `Graph.width(container.clientWidth).height(container.clientHeight)` after initialization if needed
- Add a `ResizeObserver` on `#left-pane` to handle window resizing

### 6. Update JS — detail panel show/hide
- `showDetail(node)` — set `#detail-panel` to `display: block`, `#empty-state` to `display: none`
- `closeDetail()` — set `#detail-panel` to `display: none`, `#empty-state` to `display: block`
- Diff content renders immediately (no toggle) — if `node.diffContent` exists, render it; if not, show "No diff available"
- Remove the diff toggle button and its event listener

### 7. Update JS — tooltip positioning
The tooltip currently tracks the mouse globally. With the split layout, ensure it stays within the left pane (graph area) and doesn't overflow into the right pane. Clamp `tooltip.style.left` to max `leftPane.clientWidth - tooltipWidth`.

## Validation
- Open the viewer — see 63/37 split with graph on left, panel on right
- Right pane shows FPS counter + summary stats when no node selected
- Click a node — right pane shows file details + diff (no toggle, immediate)
- Click background — right pane returns to empty/summary state
- Search + navigate — right pane updates with the selected node
- Resize window — graph and panel resize proportionally
- Clustering still works, filters still work
- Playwright tests pass (update selectors as needed)

## Risks
- **Force-graph container sizing** — force-graph reads the container dimensions on init. If the container isn't rendered yet or has 0 width, the graph won't display. Mitigate by calling `Graph.width().height()` explicitly after mount.
- **Diff viewer height** — with no max-height, very large diffs could push content below the fold. Use `flex: 1; overflow: auto` so the diff viewer scrolls independently within the right pane.
- **Tooltip overflow** — mouse near the split border could make the tooltip clip into the right pane. Clamp positioning.
