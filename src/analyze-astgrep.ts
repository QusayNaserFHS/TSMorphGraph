/**
 * ast-grep based import analyzer — alternative to ts-morph.
 *
 * Uses @ast-grep/napi for AST pattern matching instead of ts-morph's
 * full TypeScript compiler. Faster for large codebases since it uses
 * tree-sitter (native parsing) rather than the TS compiler.
 */

import { parse, Lang } from '@ast-grep/napi';
import * as path from 'path';
import * as fs from 'fs';
import type { GraphLink } from './types.js';

// Map file extensions to ast-grep languages
const EXT_LANG: Record<string, Lang> = {
  '.ts': Lang.TypeScript,
  '.tsx': Lang.Tsx,
  '.js': Lang.JavaScript,
  '.jsx': Lang.JavaScript,
};

// Import patterns to search for — ast-grep uses code-like patterns with $WILDCARDS
const IMPORT_PATTERNS = [
  'import $A from $MODULE',                 // import X from './foo'
  'import { $$$A } from $MODULE',           // import { X, Y } from './foo'
  'import * as $A from $MODULE',            // import * as X from './foo'
  'import $MODULE',                         // import './foo' (side-effect)
  'import($MODULE)',                        // dynamic import()
  'require($MODULE)',                       // CommonJS require()
];

/**
 * Extract import module specifiers from a source file using ast-grep.
 * Returns relative paths (starting with '.') only.
 */
function extractImportPaths(source: string, lang: Lang): string[] {
  const root = parse(lang, source).root();
  const modules: string[] = [];
  const seen = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    const matches = root.findAll(pattern);
    for (const match of matches) {
      const moduleNode = match.getMatch('MODULE');
      if (!moduleNode) continue;

      // Get the raw text and strip quotes
      let moduleText = moduleNode.text().replace(/^['"`]|['"`]$/g, '');

      // Only keep relative imports
      if (moduleText.startsWith('.') && !seen.has(moduleText)) {
        seen.add(moduleText);
        modules.push(moduleText);
      }
    }
  }

  return modules;
}

/**
 * Analyze imports between changed files using ast-grep.
 * Drop-in replacement for the ts-morph analyzeImports function.
 */
export function analyzeImportsAstGrep(repo: string, changedFiles: string[]): GraphLink[] {
  const tsFiles = changedFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ext in EXT_LANG;
  });
  if (tsFiles.length === 0) return [];

  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const changedSet = new Set(changedFiles);
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

  for (const f of tsFiles) {
    const fullPath = path.join(repo, f);
    if (!fs.existsSync(fullPath)) continue;

    const ext = path.extname(f).toLowerCase();
    const lang = EXT_LANG[ext];
    if (!lang) continue;

    const source = fs.readFileSync(fullPath, 'utf-8');
    const importPaths = extractImportPaths(source, lang);

    for (const moduleSpec of importPaths) {
      const dir = path.dirname(fullPath);
      const resolved = path.resolve(dir, moduleSpec);

      for (const ext of extensions) {
        const candidate = path.relative(repo, resolved + ext);
        if (changedSet.has(candidate) && candidate !== f) {
          const key = `${f}->${candidate}`;
          if (!seen.has(key)) {
            seen.add(key);
            links.push({ source: f, target: candidate });
          }
          break;
        }
      }
    }
  }

  return links;
}
