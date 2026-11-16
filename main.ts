// EMBERLINE — make.fun threejs-fps-01 entrypoint (Node 22 stdlib only).
//
// What this file does, in three steps:
//   1. Stage the game: copy this repo's game/ and screenshots/ into the
//      output directory the grader reads.
//   2. Let the vendored make.fun library summarise the staged entry into
//      dossier.json — the summary the judge reads.
//   3. Nothing else. No build step, no bundler, no network.
//
// Run it locally (outside the grader's container) with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader the output directory is /output by default.
//
// The caps below are the scorer's own (reference/gate.json). Only
// text_max_bytes changes the dossier's bytes; the rest mirror the
// scorer's refusal rules, so an entry this script accepts is one the
// scorer accepts too:
//   - at most 4 screenshots, each at most 256 KiB;
//   - at most 993 files in game/, at most 48 MiB of game files in total
//     (game/ counts beside /output's own 1000-entry cap, with its
//     screenshots/ and dossier.json).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

// Directory holding this file; the game and the screenshots sit beside it.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Grader default is /output; MAKEFUN_OUTPUT_DIR overrides it locally.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Stage game/ wholesale, then screenshots/ (only if it exists — an empty
// screenshots/ still gets created so the dossier always has the folder).
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Write the dossier with the scorer's caps (see the header comment).
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
