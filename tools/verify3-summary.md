# Baseline v3 — EMBERLINE-01 @ HEAD 4087da2 (verifikasi 17 Nov 2026, 12:39–12:50 WIB)

Commit: `4087da21dfd2192a29e7ba78ee5a6aaf52536c41` ("v3: screenshot final merged").
Semua angka di bawah diukur sendiri oleh verifier ini di HEAD tersebut.

## Gate

| Gate | Hasil | Nilai |
|---|---|---|
| Bench formal (?bench=1, port 8093, Chromium swiftshader) | LOLOS (draw calls), FPS TIDAK TERUKUR | drawCalls **178** (bench) / maks 178 di semua scene; tris bench 16.456, maks 19.220 (debug); tickAvg 0,288 ms, tickP99 3,9 ms; **fpsMedian 0,6 / fps1pct 0,2 — ARTIFAK swiftshader, BUKAN performa GPU asli** |
| Draw calls ≤180 | LOLOS (tipis) | maks 178, margin 2 call |
| Sim-test | LOLOS | **22 PASS, 0 FAIL** |
| QA headless | LOLOS | **52 PASS, 1 FAIL** (hanya AM2, sesuai putusan) |
| game/ ≤48 MiB | LOLOS | 2.284.134 byte (2,3 MiB) |
| Source (index.html + js non-vendor) ≤153.600 | LOLOS | **149.346 byte** (margin 4.254; dikonfirmasi dari blob git HEAD) |
| 0 console error di browser | LOLOS | errors 0, warnings 0, failedReqs 0 |
| Kit bundle + check | LOLOS | bundle EXIT 0 (21 sesi, 47/51 usage rows); check **12 passed, 0 failed**, 6 skipped, 5 at-submission |
| Screenshot final v3 | LOLOS | shots/robots-close.jpg (1280×800, 80.417 B), shots/start-menu.jpg (1280×800, 89.426 B), screenshots/1-action.jpg (1280×800, 65.621 B); 2-buy/3-bomb/4-win juga 1280×800, masing-masing ≤256 KiB |

## Detail bench

- Port 8093 diverifikasi BEBAS sebelum jalan (ss kosong, tanpa proses node/server lain).
- Bench SELESAI tanpa timeout kali ini (150 frame, total run browser 428 dtk).
  Timeout v2 kemungkinan besar BUKAN tabrakan port: 150 frame × ~1,7 dtk/frame
  swiftshader ≈ 255 dtk, mepet batas tunggu 300 dtk. Kali ini lolos tipis.
- FPS median 0,6 / 1% low 0,2 = kecepatan software rasterizer, bukan game.
  Target spec (median ≥60, 1% low ≥45) HANYA bisa diverifikasi di GPU asli
  (finalist review pakai desktop Chrome). Jangan pakai angka 0,6 ini sebagai
  bukti game lambat — dan jangan pula klaim FPS lolos.
- Draw calls per scene: main 157, shot_start 176, shot_play 137, shot_buy 161,
  shot_bomb 79, shot_win 122, debug 178, bench 178. Semua ≤180.

## Detail kit

- Bundle: `/tmp/verify3/transcripts.tar.gz` → salinan `tools/verify3-transcripts.tar.gz`
  (4.848.221 byte, sha256 `7cc06d5e5b27cbf61c4fd0dfafb55d43367093e102e01c2bd40cc827234d8581`).
  muse-usage.jsonl lama (v2, 51 baris) DITERIMA kit: 47 rows terpasang, 4 dari
  sebelum build dibuang (expected). Peringatan kit: 0 usage rows pada 9 dari 21
  sesi (sesi subagent; row-nya baru ditulis saat subagent selesai) — bukan gagal.
  Repo tercatat `repo.dirty` (tools/*.json + out/ sudah kotor sebelum verifikasi).
- Check (log lengkap `tools/verify3-check.log`): 12 passed 0 failed. Yang lolos
  termasuk `thinking_reproduces` 46,8% (4079/8715 baris, syarat ≥30%),
  `thinking_in_window` (3068 timestamp dalam window), `thinking_priced` (47 records),
  `snapshot`, `license_osi`, `entrypoint`. 5 item "at submission" (repo_public,
  repo_owner, repo_created_after_open, commit_in_repo, duplicate_snapshot) hanya
  bisa dicek situs saat submit — BUKAN gagal lokal.

## Detail QA

- Satu-satunya FAIL: AM2 (carrier lewat Mid Door: pintuTerbukaMax=0,00,
  planted=false; A* otonom memilih tunnel, bukan node pintu). Sesuai syarat
  (≥52/53, hanya AM2 gagal). Waypoint total 59 node (48 + 9 amendemen + 2 penghubung).

## CAVEAT PENTING — kontaminasi working tree selama verifikasi

Sesi builder v4 paralel mengubah working tree DI TENGAH verifikasi ini
(saya TIDAK mengubah file game apa pun):
- `game/src/weapons.js` diubah 05:45:15 UTC (v4-hands: jari ditumpuk + reload yaw)
- `game/src/characters.js` diubah 05:48:24 UTC (kepala bulat, 2 mata, dll.)
- File baru: `shots/v4-*.jpg` (7 file), `tools/menu-probe.cjs`, `tools/menu-shot.cjs`.

Dampak per pengukuran:
- Sim-test + QA (jalan ~05:40) — BERSIH: sebelum perubahan apa pun.
- Browser/bench (halaman dimuat 05:41–05:44, sebelum weapons.js 05:45:15;
  modul ES dimuat sekali saat load; characters.js diubah 05:48:24, setelah run
  selesai 05:48:09) — hasil bench/draw-calls/console-error mencerminkan HEAD.
  Namun TIDAK bisa di-re-run bersih tanpa checkout bersih, karena tree kini kotor.
- Kit check — BERSIH: check membaca snapshot COMMIT 4087da2, bukan working tree.
- Ukuran source 149.346 — BERSIH: dikonfirmasi dari blob git HEAD (`git ls-tree -r -l`).
- `git status` saat ini: game/src/characters.js + weapons.js Modified (v4, BUKAN saya);
  tools/verify2-*.json Modified (sudah begitu sebelum saya mulai + QA re-run saya);
  shots/verify-*.jpg Modified (output browser run saya, file terverifikasi ulang);
  out/ + tools/verify3-* + shots/v4-* Untracked. TIDAK ada commit yang saya buat.

## File output verifier ini

- `tools/verify3-browser.json` — hasil browser + bench (baru)
- `tools/verify3-browser.cjs` — salinan script verify (output dialihkan ke verify3)
- `tools/verify2-qa.json` — QA re-run di HEAD (52/1; menimpa hasil v2, isinya sama)
- `tools/verify3-transcripts.tar.gz` — bundle kit v3 (sha256 di atas)
- `tools/verify3-check.log` — log lengkap `makefun check`
- `tools/verify3-summary.md` — file ini
- `/tmp/verify3/` — backup JSON v2 + browser-run.log + bundle asli

TIDAK ADA submit, TIDAK ADA commit, TIDAK ADA perubahan file game oleh verifier.
