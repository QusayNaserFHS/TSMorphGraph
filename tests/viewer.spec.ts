import { test, expect } from '@playwright/test';
import * as path from 'path';

const SMALL_HTML = 'file://' + path.resolve('output/small.html');
const GRAPH_HTML = 'file://' + path.resolve('output/graph.html');

test.describe('Graph Viewer', () => {
  test('renders the graph canvas', async ({ page }) => {
    await page.goto(SMALL_HTML);
    await page.waitForTimeout(2000);

    const canvas = page.locator('#graph canvas');
    await expect(canvas).toBeVisible();
    await page.screenshot({ path: 'output/screenshots/01-graph-loaded.png', fullPage: true });
  });

  test('toolbar shows correct metadata', async ({ page }) => {
    await page.goto(SMALL_HTML);
    await page.waitForTimeout(1000);

    const baseSelect = page.locator('#base-select');
    await expect(baseSelect).toHaveValue('main');
    const branchSelect = page.locator('#branch-select');
    await expect(branchSelect).toHaveValue('feature/auth-refactor');

    const fileCount = page.locator('#file-count');
    await expect(fileCount).toContainText('30 files');
  });

  test('search shows results and navigates', async ({ page }) => {
    await page.goto(SMALL_HTML);
    await page.waitForTimeout(2000);

    // Focus search with Cmd+K
    await page.keyboard.press('Meta+k');
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeFocused();

    // Type a query — use a generic partial match
    await searchInput.fill('Service');
    await page.waitForTimeout(300);

    const results = page.locator('#search-results');
    await expect(results).toBeVisible();
    await page.screenshot({ path: 'output/screenshots/02-search-results.png', fullPage: true });

    // Click first result
    const firstResult = page.locator('.search-item').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
      await page.waitForTimeout(600);

      // Detail panel should open
      const panel = page.locator('#detail-panel');
      await expect(panel).toBeVisible();
      await page.screenshot({ path: 'output/screenshots/03-search-navigated.png', fullPage: true });
    }
  });

  test('filter dropdowns toggle visibility', async ({ page }) => {
    await page.goto(SMALL_HTML);
    await page.waitForTimeout(2000);

    // Screenshot initial state
    await page.screenshot({ path: 'output/screenshots/04-filters-initial.png', fullPage: true });

    // Open the Type filter dropdown
    await page.locator('#filter-type-dropdown .filter-trigger').click();
    await page.waitForTimeout(300);

    const panel = page.locator('#filter-type-dropdown .filter-panel');
    await expect(panel).toBeVisible();
    await page.screenshot({ path: 'output/screenshots/05-filter-dropdown-open.png', fullPage: true });

    // Click "None" to deselect all types
    await page.locator('#filter-type-dropdown .filter-panel-actions button', { hasText: 'None' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'output/screenshots/06-filters-none.png', fullPage: true });

    // Click "All" to reselect all types
    await page.locator('#filter-type-dropdown .filter-panel-actions button', { hasText: 'All' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'output/screenshots/07-filters-all.png', fullPage: true });

    // Toggle a single option
    const firstOption = page.locator('#filter-type-dropdown .filter-option').first();
    await firstOption.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'output/screenshots/08-filter-toggled.png', fullPage: true });

    // Test search within the dropdown
    const filterSearch = page.locator('#filter-type-dropdown .filter-panel-search input');
    await filterSearch.fill('TS');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'output/screenshots/09-filter-search.png', fullPage: true });
  });

  test('clicking a node opens detail panel', async ({ page }) => {
    await page.goto(SMALL_HTML);
    await page.waitForTimeout(3000);

    // Click near center of graph canvas to hit a node
    const graphEl = page.locator('#graph');
    const box = await graphEl.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
    }

    // Use search to reliably open a node
    await page.keyboard.press('Meta+k');
    const searchInput = page.locator('#search-input');
    await searchInput.fill('Controller');
    await page.waitForTimeout(300);
    const result = page.locator('.search-item').first();
    if (await result.isVisible()) {
      await result.click();
      await page.waitForTimeout(600);
    }

    const panel = page.locator('#detail-panel');
    await expect(panel).toBeVisible();
    await page.screenshot({ path: 'output/screenshots/10-detail-panel.png', fullPage: true });
  });

  test('diff viewer renders colored lines', async ({ page }) => {
    await page.goto(SMALL_HTML);
    await page.waitForTimeout(2000);

    // Navigate to a node via search
    await page.keyboard.press('Meta+k');
    const searchInput = page.locator('#search-input');
    await searchInput.fill('.ts');
    await page.waitForTimeout(300);
    const result = page.locator('.search-item').first();
    if (await result.isVisible()) {
      await result.click();
      await page.waitForTimeout(600);
    }

    // Check if diff section is visible and toggle it
    const diffToggle = page.locator('#dp-diff-toggle');
    if (await diffToggle.isVisible()) {
      await diffToggle.click();
      await page.waitForTimeout(300);

      const diffContent = page.locator('#dp-diff-content');
      await expect(diffContent).toBeVisible();

      // Check for colored diff lines (at least some add or del lines)
      const addLines = page.locator('.diff-line-add');
      const delLines = page.locator('.diff-line-del');
      const hunkLines = page.locator('.diff-line-hunk');
      const totalColoredLines = await addLines.count() + await delLines.count() + await hunkLines.count();
      expect(totalColoredLines).toBeGreaterThan(0);

      await page.screenshot({ path: 'output/screenshots/11-diff-viewer.png', fullPage: true });
    }
  });

  test('real repo graph renders correctly', async ({ page }) => {
    await page.goto(GRAPH_HTML);
    await page.waitForTimeout(3000);

    const canvas = page.locator('#graph canvas');
    await expect(canvas).toBeVisible();

    const fileCount = page.locator('#file-count');
    await expect(fileCount).toContainText('files');

    await page.screenshot({ path: 'output/screenshots/12-real-repo.png', fullPage: true });
  });
});
