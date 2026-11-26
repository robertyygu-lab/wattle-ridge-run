// Wattle Ridge Run — the entry program (Node 22, standard library only).
// It hands the game in: it copies this repository's game/ and screenshots/
// beside this file into the output directory and writes dossier.json there
// with buildDossier from the vendored make.fun library, so the scorer can
// rebuild the same dossier byte for byte.
//
// Inside the grader the output directory is /output. Anywhere else, the
// MAKEFUN_OUTPUT_DIR environment variable stands in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output directory so a second run writes exactly the
// same bytes as the first — stale files from an earlier build must never
// leak into the hand-in.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const gameOut = join(outputDir, 'game');
cpSync(join(repoRoot, 'game'), gameOut, { recursive: true });

const shotsOut = join(outputDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
const shotsIn = join(repoRoot, 'screenshots');
if (existsSync(shotsIn)) {
  cpSync(shotsIn, shotsOut, { recursive: true });
}

// The scorer's caps for this bounty: the dossier text is capped at 160 KiB,
// at most 4 screenshots of at most 256 KiB each, at most 993 entries under
// game/ totalling at most 48 MiB, and no path under game/ longer than 1000
// bytes. Passing them here makes this program fail exactly where the
// scorer would refuse the entry.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Wattle Ridge Run handed in to ${outputDir}`);
