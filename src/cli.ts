#!/usr/bin/env node
import { execSync } from 'child_process';
import { createServer } from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { analyze, analyzeAllBranches, generateHtml, getBranches, type AnalyzeEngine } from './analyze.js';

// ── CLI Args ────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let repo = process.cwd();
  let base = 'main';
  let branch = 'HEAD';
  let diffContent = false;
  let listBranches = false;
  let output = path.join(process.cwd(), 'output');
  let open = false;
  let serve = false;
  let port = 3742;
  let engine: AnalyzeEngine = 'ts-morph';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) repo = path.resolve(args[++i]);
    if (args[i] === '--base' && args[i + 1]) base = args[++i];
    if (args[i] === '--branch' && args[i + 1]) branch = args[++i];
    if (args[i] === '--diff-content') diffContent = true;
    if (args[i] === '--list-branches') listBranches = true;
    if (args[i] === '--output' && args[i + 1]) output = path.resolve(args[++i]);
    if (args[i] === '--open') open = true;
    if (args[i] === '--serve') serve = true;
    if (args[i] === '--port' && args[i + 1]) port = parseInt(args[++i]);
    if (args[i] === '--engine' && args[i + 1]) engine = args[++i] as AnalyzeEngine;
  }

  return { repo, base, branch, diffContent, listBranches, output, open, serve, port, engine };
}

// ── Server mode ─────────────────────────────────────────────────────

function startServer(opts: { repo: string; base: string; branch: string; diffContent: boolean; port: number; engine: AnalyzeEngine }) {
  const { repo, port } = opts;

  // Initial analysis
  let currentBase = opts.base;
  let currentBranch = opts.branch;
  let currentData = analyze({ repo, base: currentBase, branch: currentBranch, diffContent: opts.diffContent, engine: opts.engine });
  let currentHtml = generateHtml(currentData);

  console.log(`Initial analysis: ${currentData.nodes.length} files, ${currentData.links.length} links`);

  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(currentHtml);
    } else if (url.pathname === '/api/branches') {
      const branches = getBranches(repo);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ branches, current: { base: currentBase, branch: currentBranch } }));
    } else if (url.pathname === '/api/analyze') {
      const newBase = url.searchParams.get('base') || currentBase;
      const newBranch = url.searchParams.get('branch') || currentBranch;
      const withDiff = url.searchParams.get('diff') !== 'false' && opts.diffContent;

      console.log(`Re-analyzing: ${newBase}...${newBranch}`);
      try {
        currentBase = newBase;
        currentBranch = newBranch;
        currentData = analyze({ repo, base: newBase, branch: newBranch, diffContent: withDiff, engine: opts.engine });
        currentHtml = generateHtml(currentData);
        console.log(`  ${currentData.nodes.length} files, ${currentData.links.length} links`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(currentData));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\nServer running at ${url}`);
    console.log('API endpoints:');
    console.log(`  GET /api/branches — list available branches`);
    console.log(`  GET /api/analyze?base=X&branch=Y — re-analyze diff\n`);

    // Auto-open browser
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open'
      : platform === 'win32' ? 'start'
      : 'xdg-open';
    try {
      execSync(`${cmd} "${url}"`);
    } catch {
      // silent
    }
  });
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const { repo, base, branch, diffContent, listBranches, output: outDir, open: shouldOpen, serve, port, engine } = parseArgs();

  // List branches mode
  if (listBranches) {
    const branches = getBranches(repo);
    console.log(JSON.stringify(branches, null, 2));
    return;
  }

  // --open implies --serve (live branch switching requires a server)
  if (serve || shouldOpen) {
    console.log(`Repository: ${repo}`);
    console.log(`Initial diff: ${base}...${branch}`);
    startServer({ repo, base, branch, diffContent, port, engine });
    return;
  }

  // Static output mode (no --open, no --serve)
  console.log(`Repository: ${repo}`);
  console.log(`Diff: ${base}...${branch}`);
  console.log(`Engine: ${engine}`);
  if (diffContent) console.log('Including diff content for each file');

  try {
    const graphData = analyze({ repo, base, branch, diffContent, engine });

    console.log(`Found ${graphData.nodes.length} changed files`);
    console.log(`Found ${graphData.links.length} import links`);

    // Pre-analyze all other branches (lightweight, no diff content)
    console.log('Analyzing other branches...');
    const allBranchData = analyzeAllBranches(repo, graphData.meta.base, graphData.meta.branch, diffContent);
    const branchCount = Object.keys(allBranchData).length;
    console.log(`Pre-analyzed ${branchCount} branches for instant switching`);

    // Write output
    fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, 'graph.json');
    fs.writeFileSync(jsonPath, JSON.stringify(graphData, null, 2));
    console.log(`Written: ${jsonPath}`);

    const htmlPath = path.join(outDir, 'graph.html');
    fs.writeFileSync(htmlPath, generateHtml(graphData, allBranchData));
    console.log(`Written: ${htmlPath}`);

    console.log('\nDone! Open output/graph.html in your browser.');
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

main();
