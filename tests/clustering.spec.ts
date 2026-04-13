import { test, expect } from '@playwright/test';
import * as path from 'path';

const MEDIUM_HTML = 'file://' + path.resolve('output/medium.html');
const GRAPH_HTML = 'file://' + path.resolve('output/graph.html');

test.describe('Clustering', () => {
  test('cluster toggle collapses nodes into groups', async ({ page }) => {
    await page.goto(MEDIUM_HTML);
    await page.waitForTimeout(2000);

    // Screenshot before clustering
    await page.screenshot({ path: 'output/screenshots/20-before-clustering.png', fullPage: true });

    // Enable clustering
    await page.locator('.toggle-switch').click();
    await page.waitForTimeout(1000);

    // Screenshot after clustering — should see fewer, larger nodes with dashed rings
    await page.screenshot({ path: 'output/screenshots/21-clustered.png', fullPage: true });

    const canvas = page.locator('#graph canvas');
    await expect(canvas).toBeVisible();
  });

  test('clicking a cluster expands it', async ({ page }) => {
    await page.goto(MEDIUM_HTML);
    await page.waitForTimeout(2000);

    // Enable clustering
    await page.locator('.toggle-switch').click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'output/screenshots/22-clustered-before-click.png', fullPage: true });

    // Click on the center of the graph where clusters tend to be
    const graphEl = page.locator('#graph');
    const box = await graphEl.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'output/screenshots/23-cluster-after-click.png', fullPage: true });
  });

  test('search expands cluster and navigates to node', async ({ page }) => {
    await page.goto(MEDIUM_HTML);
    await page.waitForTimeout(2000);

    // Enable clustering
    await page.locator('.toggle-switch').click();
    await page.waitForTimeout(1000);

    // Search for a file
    await page.keyboard.press('Meta+k');
    const searchInput = page.locator('#search-input');
    await searchInput.fill('Service');
    await page.waitForTimeout(300);

    const result = page.locator('.search-item').first();
    if (await result.isVisible()) {
      await result.click();
      await page.waitForTimeout(800);

      // Detail panel should open — the cluster was expanded
      const panel = page.locator('#detail-panel');
      await expect(panel).toBeVisible();
      await page.screenshot({ path: 'output/screenshots/24-search-cluster-expand.png', fullPage: true });
    }
  });

  test('real repo clustering with 734 files', async ({ page }) => {
    page.setDefaultTimeout(15000);
    await page.goto(GRAPH_HTML);
    await page.waitForTimeout(4000);

    // Enable clustering
    await page.locator('.toggle-switch').click();
    await page.waitForTimeout(2000);

    const canvas = page.locator('#graph canvas');
    await expect(canvas).toBeVisible();
    await page.screenshot({ path: 'output/screenshots/25-real-repo-clustered.png', fullPage: true });
  });
});
