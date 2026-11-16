# EMBERLINE — Build Spec (threejs-fps-01, make.fun)

Koordinator: sesi build in-window 17 Nov 2026. Window: 17 Nov 00:00 → 24 Nov 00:00 WIB.
Target: v1 playable SECEPATNYA 17 Nov (provisional dev rate), iterasi sampai 24 Nov.
Repo: github.com/gumatara11/makefun-threejs-fps (baru, publik, MIT).
Work dir: ~/workspace/makefun-threejs-fps-01/ — repo git di dalamnya. Bukti verifikasi di shots/ (DI LUAR repo).

## 0. ATURAN KERAS (baca dulu)

- TULIS KODE SENDIRI di sesi ini. Repo -02 (~/workspace/makefun-threejs-fps-02/repo/) hanya
  REFERENSI arsitektur/pola terverifikasi — JANGAN copy-paste mentah file/fungsi -02 (kode itu
  ditulis di luar window -01; copy mentah = authored coverage 0 untuk baris itu). Boleh meniru
  STRUKTUR modul, nama konstanta beku, dan pola yang terbukti (fixed-step 60 Hz, ?shot=, A* graph,
  teknik tangan v8–v15). Setiap baris game harus diketik/ditulis lewat tool write/edit di sesi ini.
- Syarat transkrip: ≥30% baris terlacak (authored/pasted), main.ts ≥1 baris authored, ≥5 assistant
  turns berisi teks/thinking, ada file yang direvisi ≥2x. Simpan usage ke muse-usage.jsonl (parent
  yang menjalankan bundle + check). Jangan ubah vendor/makefun-threejs.ts dan file three.js kit.
- JANGAN SUBMIT (parent yang atur submit + kuota, hanya atas kata eksplisit Gito "submit").
- JANGAN sentuh TITAN (~/workspace/custom-skills/titan-security-x/) dan JANGAN sentuh repo -02.
- JANGAN klaim selesai tanpa bukti: setiap klaim butuh screenshot/log/bench. Kekurangan wajib
  dilaporkan jujur.
- Free-only, tanpa biaya. Tanpa network request di game (semua referensi relatif di dalam game/).

## 1. ARAH VISUAL — IKUTI 3 GAMBAR KONSEP GITO (ini MENGALAHKAN palet foundry di PLAN.md)

File gambar (sudah dibaca koordinator):
- ~/workspace/user/files/7256_1_bnz6.jpg — gameplay first-person: kota anime TERANG, pohon sakura
  pink, karakter warna-warni, senjata pink/biru, HUD skor 3-2, timer 00:38, minimap bulat, HP 100, ammo 21.
- ~/workspace/user/files/7255_2_llq0.jpg — map: kota futuristik langit biru, sakura, Site A merah/oranye
  (kontainer, huruf A besar), Site B biru (huruf B besar), jembatan penyeberang, menara cincin di tengah
  kejauhan, checklist "Optimized for Bounty" (low-poly, Texture ≤2K, Map 7–12 MB, Total ≤48 MB,
  Draw Calls ≤180, Triangles ≤350.000).
- ~/workspace/user/files/7257_3_q48d.jpg — menu utama: 5 robot chibi ORIGINAL (kuning, pink
  kucing, biru tengah, merah, hijau), menu PLAY/OPERATORS/LOADOUT/BATTLE PASS/EVENT/STORE,
  5v5 Bomb Defuse, "Selamat datang di EMBERLINE!".

Palet BARU (ganti beton abu-abu/sodium/teal di PLAN.md §6):
- Langit biru cerah + awan putih + matahari; kabut tipis biru-putih (fog 25→70 m tetap).
- Bangunan futuristik putih/abu terang + trim neon cyan/magenta; jalan tile terang + marka kuning.
- Sakura pink: pohon-pohon (canopy blob pink + batang coklat) + kelopak jatuh (partikel).
- Site A = oranye/merah (kontainer merah, huruf A besar, garis lantai oranye). Site B = biru
  (tangki/bangunan biru, huruf B besar, garis lantai biru).
- Menara cincin (ring tower) sebagai landmark latar di tengah kejauhan + skybridge di atas Mid
  (prop visual, BUKAN jalur jalan — tidak ada collision, tidak bisa dinaiki).
- Warna tim (ganti teal vs amber di spec §7): PENYERANG = oranye/merah (visor + stripe bahu +
  panel dada oranye), DEFENDER = biru/cyan (visor + stripe + panel biru). Harus terbaca dari 46 m.
- Karakter: 5 robot chibi ORIGINAL (jangan tiru desain game lain): tinggi total 1,80 m (spec),
  kepala besar (kotak 0,30 + telinga/antena/horn dekoratif), torso gemuk, kaki pendek, lengan kotak
  menyatu dengan senjata. 5 desain individu: (1) kuning + fin helm, (2) pink + telinga kucing,
  (3) biru + antena bola, (4) merah + horn + syal, (5) hijau + visor lebar. Desain sama dipakai kedua
  tim; pembeda tim = visor/stripe/panel (oranye vs biru). Pembawa bom: panel ransel + lampu beep
  berkedip. Mati: jatuh miring 0,4 dtk lalu fade 2 dtk. Hit feedback: spark + flash (tanpa gore).
- Tangan first-person = TANGAN ROBOT: logam putih/abu terang, jari bersegmen, ujung jari berwarna,
  lengan lapis baja putih + ring warna tim. WAJIB pakai teknik tangan v8–v15 -02 (ANIME-UPGRADE.md):
  kontras terang-di-gelap (di sini: jari metal terang di grip gelap), jari terpisah nyata (gap lebar,
  ruas lebih panjang, ujung capai sudut depan grip), lengan lathe (belly asimetris Gaussian peak
  0,024 sigma 0,10 ke arah kamera, shadow band gelap di bawah belly, 3 ring lipat, tekstur weave
  canvas), wrist ball diratakan + tersembunyi di cuff (hanya sliver terlihat), cuff lebar warna tim,
  lengan panjang sampai keluar tepi bawah frame, lengan P9 ramping + sudut lebar, grip hand VK-47
  tegak. KRITIS (pelajaran v14→v15): cuff HARUS menyentuh tepi bawah jari — TIDAK BOLEH ada gap
  gelap antara telapak dan cuff (tangan melayang). Verifikasi dengan screenshot ZOOM (crop
  perbesar) seperti hands-v15, untuk P9 dan VK-47, idle + reload.

## 2. MEKANIK BEKU (jangan diubah — dari Final Design Specification)

- Mode: 5v5 (pemain penyerang + 4 bot sekutu vs 5 bot defender), first-to-8, maks 15 ronde, tanpa
  halftime. Menang ronde (urutan cek per tick): ledakan → defuse → eliminasi (kecuali post-plant) →
  timeout. Post-plant: penyerang habis setelah plant → ronde lanjut sampai defuse/ledakan.
- Waktu: BUY 12 dtk (gerak terkunci, menu beli B, timer belum jalan), ROUND 100 dtk (berhenti permanen
  saat plant, diganti timer bom), PLANT 3,2 dtk (tahan E di zona plant; batal bila gerak/ganti
  senjata/lepas E; damage TIDAK membatalkan), BOMB 35 dtk (beep makin cepat 10 dtk terakhir),
  DEFUSE 5,0 dtk (aturan batal sama), banner hasil 4 dtk.
- HP 100 semua. Zona: kepala ×2 (Longbow ×4), torso ×1, kaki ×0,75. Damage dibulatkan per hit.
  Kevlar $650 (vest+helm satu item): damage peluru ×0,65, frag ×0,75; hilang saat mati.
- Senjata (harga/dmg torso/RPM/mag/cad./reload/spread diam/spread gerak/recoil/falloff/gerak/tarik):
  - P9 $0, 26 dmg, 400 RPM, 12/48, 1,6 dtk, 0,004/+0,026, 0,006 rad, 25 m→60%, 5,2 m/s, 0,45 dtk.
    Semi-otomatis. Headshot 52.
  - Breacher $1.050, 9×8 pellet, 68 RPM, 6/24, 3,2 dtk, 0,045/+0,015, 0,030 rad, 10 m→25% di 20 m,
    5,0 m/s, 0,60 dtk. Pompa. 1 hit penuh = 72 dmg.
  - Kestrel-9 $1.500, 22 dmg, 857 RPM, 32/96, 2,0 dtk, 0,006/+0,029, 0,004 rad, 18 m→55%, 5,2 m/s,
    0,55 dtk. Otomatis.
  - VK-47 $2.700, 34 dmg, 600 RPM, 30/90, 2,4 dtk, 0,0022/+0,028, 0,009–0,013 rad, 40 m→70%,
    4,9 m/s, 0,65 dtk. Otomatis. Recoil spray naik 8%/tembakan sampai ×1,8, pulih 0,25 dtk.
  - Longbow $4.750, 110 dmg, 41 RPM, 5/20, 3,4 dtk, 0,0005 (optik)/0,050 (tanpa optik)/+0,055,
    0,045 rad, tanpa falloff s.d. 80 m, 4,6 m/s, 0,80 dtk. Bolt-action. Optik 2,5× klik kanan
    (FOV 74→30). Satu-satunya one-shot torso tanpa kevlar.
  - Crouch: spread total ×0,7. Di udara: spread ×1,6. Recoil VK-47/Kestrel-9 naik 8%/tembakan
    sampai ×1,8, pulih 0,25 dtk setelah berhenti menembak. Pola vertikal dominan + simpangan
    horizontal acak terbatas, sama untuk pemain dan bot.
- Granat (maks 1/jenis/ronde/orang, maks 3 total; yang tak terpakai hilang saat mati):
  - Frag $300: ledak 1,5 dtk setelah lempar; 85 dmg di pusat → 10 di radius 6 m, butuh LOS dari
    titik ledak; kevlar ×0,75.
  - Smoke $300: berkembang 0,8 dtk jadi bola r 3,5 m selama 12 dtk; memutus LOS bot + pandangan
    pemain; tidak mengurangi damage.
  - Flash $200: ledak 1,2 dtk; target ≤15 m + LOS: buta 2,2 dtk (menghadap) / 0,8 dtk (membelakangi);
    bot terkena berhenti menembak selama itu.
  - Lemparan: kecepatan awal 18 m/s, gravitasi penuh, pantul restitusi 0,4.
- Ekonomi: awal $800; kill +$300; menang +$3.250; kalah +$1.900 (tetap, tanpa eskalasi); plant
  +$300 per anggota tim penyerang (dibayar di akhir ronde); defuse +$300 khusus penjink; cap $9.000.
  Beli hanya saat fase beli + di zona spawn sendiri; B buka menu; harga menu = harga terpotong;
  tanpa refund; primer baru tidak bisa dibeli bila sudah pegang primer (jatuhkan dulu dengan G).
  Primer jatuh saat mati (bisa diambil F oleh kawan/lawan, hilang di akhir ronde); P9 tidak pernah
  jatuh; granat tak terpakai hilang; kevlar hilang. G = drop primer sukarela (bom tidak bisa
  dijatuhkan sukarela). Carry-over: yang selamat pertahankan primer + sisa ammo (magasin diisi ulang
  gratis ke penuh, cadangan tidak ditambah) + kevlar + granat tak terpakai. Yang mati respawn hanya
  dengan P9 + magasin penuh. Membeli senjata yang sama tidak boleh; cadangan tidak dijual terpisah.
- Kontrol: WASD gerak, mouse bidik, klik tembak, R reload, Ctrl crouch, Space lompat, B menu beli,
  E plant/defuse (tahan), F ambil senjata, G jatuhkan primer, 1 primer, 2 P9, 3 Frag, 4 Smoke,
  5 Flash. Ganti senjata membatalkan reload (reload ulang dari nol). Sensitivitas mouse default 1,0
  (di config, dilaporkan).
- Gerakan: jalan 5,2 m/s (per senjata, lihat tabel), crouch 2,4 m/s, lompat (Space), akselerasi/
  deselerasi, collision AABB vs kotak map, bunny-hop tidak memberi keuntungan.

## 3. MAP — Foundry Yard jadi KOTA ANIME 72×48 m (angka beku + amendemen map)

Koordinat beku (X timur 0–72, Z utara 0–48, asal sudut barat daya):
- Spawn penyerang X 2–10, Z 19–29 (8×10 m, 5 titik spawn berjarak 1,5 m, zona beli).
- Spawn defender X 56–67, Z 20–28 (11×8 m, di antara dua site, zona beli).
- A-long: koridor utara Z 36–44, X 10→56, sightline lurus terpanjang 46 m (X 12–58, Z 40).
- Site A X 56–69, Z 32–44; zona plant X 57,5–67,5, Z 33,5–42,5 (10×9 m, garis lantai oranye).
- Mid: koridor tengah Z 21–29, X 10→56, sightline 38 m.
- Pintu Mid-A / Mid-B: koridor X 46–50, Z 29–36 (ke A) dan Z 13–21 (ke B).
- B-tunnel: koridor selatan Z 6–14, X 10→56, langit-langit 3,0 m, dua belokan siku.
- Site B X 56–69, Z 4–16; zona plant X 57,5–67,5, Z 5,5–14,5 (garis lantai biru).
- Tinggi: dinding perimeter 5,0 m; dinding dalam 3,2–5,0 m; langit-langit tunnel 3,0 m.
- Jarak beku: spawn penyerang→Site A via A-long 64 m (~13 dtk); →Site B via B-tunnel 62 m;
  →tengah Mid (X 30) 26 m (~5 dtk); defender→site 14 m (~3 dtk); rotasi A→B via spawn 28 m
  (~6 dtk); Mid→site seberang via Pintu Mid 20–24 m (~4–5 dtk).
- Cover beku: Site A 3 kontainer (6×2,4 m, tinggi 2,6 m) + 4 crate (1,2 m). Site B 2 tangki
  silinder (r 1,5 m, tinggi 3,0 m) + 4 crate + 1 meja bengkel panjang. A-long crate di X 24 dan
  X 40. Mid crate di X 20 dan X 42. Tunnel pipa tegak di dua belokan. Semua cover = collider AABB
  (silinder didekati kotak) + penahan peluru.

AMENDEMEN MAP (pakai — dari dustline-01-map-concept.md):
1. MID DOOR — pintu baja geser di Mid pada X 30 (menggantikan pilar Mid beku di X 30), membentang
   Z 21–29, celah pintu ~4 m. Proximity: terbuka saat pemain/bot ≤3 m, menutup 4 dtk setelah area
   kosong. Tertutup = memutus sightline Mid + meredam suara (radius dengar lewat pintu tertutup
   ×0,5). Visual: panel baja + strip neon + garis hazard di rel lantai. Bot: 1 node pintu (titik
   tunggu); pintu tertutup = cover sementara, BUKAN tembok — tidak ada rute putus. Fallback bila
   berisiko: pintu dikunci terbuka (gapura statis) — keputusan fallback WAJIB dicatat di laporan.
2. SERVICE TUNNEL — koridor beratap di bawah Mid (X 28–32, Z 14–36), menghubungkan titik tengah
   B-tunnel (mulut di Z 14, X 30) ke underpass A-long (mulut di Z 36, X 30). Langit-langit 2,6 m,
   strip neon di dinding, pipa sepanjang dinding, chevron di mulut. Waypoint: node di kedua mulut
   + 2 node di dalam. Rusher boleh memilih rute ini; carrier bom boleh lewat sini (wajib dibuktikan
   di tes auto). Tanpa dead end. Visual gelap tapi strip neon cukup terang agar scene terbaca.
3. INTERIOR SITE A & B — Site A jadi gudang beratap yang bisa dimasuki: tumpukan kontainer sebagai
   cover dalam, lampu gantung, 2 pintu masuk (dari A-long dan dari Mid). Site B jadi bengkel beratap:
   meja kerja + klaster tangki sebagai cover tengah, pipa overhead, ventilasi dinding, 2 pintu masuk
   (dari B-tunnel dan dari Mid). Setiap interior ≥2 jalan keluar; tanpa koridor >~15 m tanpa
   belokan/cover; ~20 prop per interior dari material yang sudah ada. Atap interior = slab visual
   yang TIDAK cast shadow (agar directional light tetap menjangkau; interior diterangi 1 point
   light masing-masing — lihat §6).
- Waypoint graph: 48 node beku (A-long 10, Mid 10, B-tunnel 10, dua pintu Mid 4, dua site 8,
  dua spawn 6) DITAMBAH node amendemen: pintu Mid 1, tunnel 4 (2 mulut + 2 dalam), interior
  Site A 2, interior Site B 2 → total ~57 node. Laporkan jumlah akhir. A* di atas graph ini,
  dihitung ulang hanya saat tujuan berubah/jalur terblokir.

## 4. BOT AI (beku)

- Peran (tidak diundi ulang antar-ronde): A1 Rusher (ikuti lane pilihan pemain, maks 8 m di depan
  pemain; Kestrel-9 lalu VK-47), A2 Rifleman pendukung (ikuti pemain offset 4–6 m, jaga sudut
  berlawanan dari A1; VK-47), A3 Lurker (lambat, crouch 15 m terakhir, ke lane yang tidak dipilih
  pemain; hanya serang target terlihat; VK-47), A4 Pembawa bom awal + holder Mid (ikuti kelompok
  utama dari belakang, jaga Mid saat eksekusi site; VK-47/Breacher), D1 Holder Site A (satu sudut
  di Site A, tidak mengejar keluar sebelum plant/kontak terkonfirmasi; VK-47), D2 Sniper (jaga
  sightline A-long dari Site A; rotasi ke Mid hanya setelah plant di B terkonfirmasi; Longbow),
  D3 Holder Site B (seperti D1; VK-47/Breacher), D4 Rotator Mid (tahan Mid; pertama rotasi ke site
  kontak; Kestrel-9/VK-47), D5 Pendukung rotasi (dekat spawn defender; rotasi ikut D4 + jeda 2 dtk,
  jaga jalur spawn; VK-47).
- Persepsi: FOV 100° (50°/sisi); periferal 130°/6 m (target bergerak ≤6 m terdeteksi sampai 65°/sisi,
  reaksi 2×); jarak pandang 55 m; LOS raycast tiap 0,12 dtk bergilir (torso + kepala; smoke/dinding/
  cover penuh memutus); bot tidak pernah tahu posisi target yang belum terlihat/didengar; reaksi
  0,28 dtk setelah target terlihat terus-menerus 0,15 dtk (rusher 0,25; holder 0,30; sniper 0,35);
  memori target 4,0 dtk (bergerak ke posisi terakhir, lalu cari ulang); gangguan pandang <0,12 dtk
  tidak mereset keterlihatan 0,15 dtk.
- Pendengaran (radius): Longbow/VK-47 45 m; Breacher 40 m; Kestrel-9/P9 35 m; langkah lari 12 m;
  crouch 4 m; plant 15 m (hanya ketukan awal/akhir); defuse 10 m; reload 6 m; pantulan granat 8 m.
  Dinding penuh di antara sumber dan bot: radius ×0,5. Tunnel tertutup: sumber di luar tunnel
  dianggap berdinding. Respons dengar per peran: holder menoleh, rotator menyelidiki. Satu sumber
  kebenaran audio: nilai keras suara sama untuk volume pemain dan radius reaksi bot.
- Akurasi bot: spread senjata + tambahan per ronde (ronde 1–3 +2,2°; 4–7 +1,8°; 8+ +1,5°). Burst
  3–5 peluru lalu jeda 0,4 dtk (Longbow: 1 tembakan lalu reposisi). Damage bot = tabel pemain.
- Pathfinding: A* 48+ node; pisah antar-bot 0,6 m; prioritas ruang untuk penanam/pen-defuse.
  Debug graph visual via ?debug=1 (bukan tombol pemain).
- Pembawa bom: bom dimulai di A4. Pemain bisa ambil alih dengan berjalan melewatinya di spawn saat
  fase beli; setelah itu pembawa tidak berpindah kecuali pembawa mati. Pembawa mati → bom jatuh,
  bisa diambil penyerang mana pun dengan berjalan melewatinya; defender yang melihat bom jatuh
  menahan posisi menghadap bom (1 bot terdekat). Keputusan ambil bom tiap 1 dtk: penyerang hidup
  terdekat mengambil kecuali sedang engage; bila tidak ada yang mengambil dalam 10 dtk, penyerang
  hidup terdekat dipaksa mengambil.
- Playbook bom: plant terkonfirmasi → 2 defender hidup terdekat retake bersama lewat 2 rute berbeda
  bila tersedia; sisanya menyusul lewat rute tercepat; tidak ada defender menunggu di site lain.
  Defuse: defender hidup terdekat men-defuse; yang lain tahan sudut masuk site. Defuse dihentikan
  hanya bila defender lain terdekat mati DAN pen-defuse kena damage 2× dalam 1 dtk → geser ke cover
  terdekat, defender berikutnya ambil alih. Post-plant penyerang: posisi dalam radius 12 m dari bom,
  menghadap rute masuk defender, tidak mengejar keluar radius; bereaksi ke suara defuse (10 m).
  Sebelum plant: defender tidak rotasi hanya karena suara samar di luar radius dengar; rotasi awal
  hanya D4 dan D5; holder tetap sampai kontak terkonfirmasi di sitenya atau plant terjadi.
- Beli bot (deterministik, tiap fase beli, urutan prioritas pada dompet sendiri, beli baris pertama
  yang terjangkau + belum dimiliki, lanjut granat bila sisa cukup):
  1. (khusus D2) ≥$5.400 → Longbow + Kevlar. D2 menabung ke baris 1: lewati baris 2–4 selama uang
     <$5.400 dan tim tidak kalah 3 ronde beruntun; setelah itu beli seperti bot lain. Penghitung
     kalah beruntun D2 milik tim, direset kemenangan tim.
  2. ≥$3.350 → VK-47 + Kevlar. 3. ≥$2.150 → Kestrel-9 + Kevlar. 4. ≥$1.700 → Breacher + Kevlar.
  5. ≥$650 dan belum ber-kevlar → Kevlar saja. 6. sisa ≥$300/$200 → Frag lalu Flash bila belum
  membawa. Bot TIDAK membeli Smoke. Di bawah semua syarat → menabung (eco). Beli bot serentak di
  awal fase beli.

## 5. ARSITEKTUR KODE (modul satu tugas; fixed-step 60 Hz terpisah dari render)

```
game/
  index.html            # import map "three" -> ./vendor/three/three.module.min.js; HUD DOM; overlay
                        # start/pause/buy/end; minimap canvas; ?shot= / ?bench= / ?debug= dibaca di sini
  src/
    main.js             # bootstrap: renderer, loop, fixed-step 60 Hz, debug API window.__EMBERLINE__
    config.js           # SEMUA konstanta beku (§2–§4 + harga + map + perf) — satu sumber angka
    state.js            # satu tempat state: match, ronde, tim, uang, bom, granat, efek (tanpa state tersebar)
    world.js            # data map: lantai/dinding/cover AABB, spawn, sites, waypoint graph + A*, Mid door,
                        # tunnel, interior; helper collision + LOS (raycast vs AABB)
    input.js            # keyboard + mouse + pointer lock + focus loss (bersihkan tombol + pause)
    player.js           # gerakan pemain: accel/desel, crouch, jump, collision, scope Longbow
    weapons.js          # definisi senjata, tembak, recoil/spread, reload, ganti senjata, lempar granat,
                        # viewmodel senjata + TANGAN ROBOT (teknik §1), animasi reload/switch
    grenades.js         # fisika + efek Frag/Smoke/Flash, asap memutus LOS
    bots.js             # AI: peran, state machine, persepsi, pendengaran, A*, beli bot, playbook bom
    combat.js           # raycast hit, zona tubuh, damage, killfeed, hitmarker
    rounds.js           # fase ronde, kondisi menang (urutan beku), ekonomi, buy menu, plant/defuse, reset
    characters.js       # model robot chibi (5 desain §1), walk cycle sinus, pose mati, panel pembawa bom
    render.js           # scene three.js: kota terang, sakura, neon, interior, pintu, tunnel, skybridge,
                        # ring tower, lighting, tracer/muzzle/ledakan (pool), kelopak jatuh
    audio.js            # synth WebAudio: tembakan per senjata, reload, langkah, plant/defuse beep, ledakan,
                        # stinger menang/kalah, hit tick; cap suara serentak + prioritas kedekatan
    hud.js              # update HUD DOM (health/ammo/timer/score/money/ikon tim/killfeed/banner/crosshair
                        # dinamis/hitmarker/indikator arah damage) + MINIMAP LIVE canvas (baca state, ~10 Hz)
    shots.js            # mode ?shot=start|play|buy|bomb|win&seed=1 : pose kamera + state deterministik
  vendor/three/
    three.module.min.js # kit, byte-for-byte (0.187.0)
    three.core.min.js   # kit, byte-for-byte
main.ts                 # copy game/ + screenshots/ ke /output, tulis dossier.json (kit buildDossier)
serve.ts                # static server lokal (starter)
vendor/makefun-threejs.ts # kit, JANGAN DIUBAH
screenshots/           # 4 file (lihat §7)
LICENSE                 # MIT, baris pertama SPDX-License-Identifier: MIT
README.md               # template kit + 3 badge (slug threejs-fps-01)
.makefun/owner.json     # {"wallet": "Gwx1ADnL9w2Toq79P2APuU1hBW9zsQmTJq1XqB2fBG34"}
```

- Fixed-step sim 60 Hz; render bebas. Tanpa alokasi objek baru tiap frame di hot loop (reuse
  Vector3 dkk). State di satu tempat (state.js). Tanpa duplikasi/dead code.
- Budget source non-vendor (yang dibaca judge, cap 160 KiB): TARGET ≤150 KiB total
  (index.html + semua .js non-vendor). Alokasi kasar: config 7K, state 3K, world 13K, input 3K,
  player 5K, weapons 18K, grenades 7K, bots 20K, combat 6K, rounds 12K, characters 12K,
  render 18K, audio 5K, hud 10K, shots 4K, main 7K, index.html 7K. Tulis hemat (komentar
  pendek, tanpa duplikasi). Verifier mengukur total byte sebelum tiap bundle.
- Import order di main.js (menentukan urutan baca judge, DFS dari index.html): config, state,
  world, weapons, combat, bots, rounds, player, input, grenades, characters, render, audio, hud,
  shots.
- Debug API (untuk verifikasi otomatis): window.__EMBERLINE__ = { state, config, bench hasil,
  teleport/force fungsi uji (forcePlant, forceDefuse, killAll, setMoney, setRound), simStats
  (tick avg/p99, draw calls, tris), errors[] }. Mode ?bench=1: skenario baku (tembak terpola
  30 dtk di Site A + plant/ledakan Site B + Mid firefight + Smoke) mencatat distribusi frame time
  ke konsol + window.__bench. Mode ?debug=1: tampilkan waypoint graph.
- Semua referensi relatif; TANPA network. Pixel ratio renderer maks 1,5. Resize tanpa reload.
  Pointer lock gagal → layar pause, bukan layar kosong.

## 6. PERF & ANGGARAN VISUAL (keras)

- ≤180 draw calls, ≤350.000 tris, ≤6 dynamic light (1 directional berbayang shadow 2048,
  1 hemisphere, ≤4 point tanpa bayangan: interior Site A 1, interior Site B 1, tunnel 1, muzzle
  flash pool 1), ≤24 material unik (MeshStandardMaterial satu palet terang), ≤300 partikel aktif
  (pool tetap), ≤32 tracer (pool), fog linear 25→70 m.
- Target ukur: FPS median ≥60 dan 1% low ≥45 pada 1280×800 (adegan terberat: 10 karakter terlihat,
  baku tembak aktif, shadow hidup); tick sim rata-rata ≤4 ms / p99 ≤8 ms; buka halaman → bisa
  dimainkan ≤2 dtk.
- Urutan pengorbanan bila FPS tidak tercapai: partikel → shadow map 2048→1024 → jumlah point
  light → pixel ratio 1,5→1,25. Gameplay, jumlah bot, ukuran map TIDAK disentuh demi FPS.

## 7. SCREENSHOT (4 file, cover = 1-...; via ?shot= deterministik, seed=1)

- 1-action.jpg (COVER, 1280×800): gameplay mid-round — pemain membidik musuh di lane, HUD lengkap,
  crosshair + hitmarker, musuh robot terlihat jelas, sakura + kota terang terbaca.
- 2-buy.jpg: buy menu antar ronde (nama + harga + uang + status terjangkau).
- 3-bomb.jpg: bomb site — bom ter-plant / pemain defuse, timer bom terlihat.
- 4-win.jpg: banner ronde menang + skor tim.
- Syarat gate: PNG/JPEG asli render kode sendiri, ≤256 KiB tiap file, sisi panjang ≤1280, sisi
  pendek ≥480. Ambil via Playwright dari ?shot= (1280×800, kompres ≤256 KiB).

## 8. LAYAR & UX (wajib)

- Layar pembuka: nama EMBERLINE, tujuan mode 2 kalimat (tanam bom di Site A/B atau eliminasi;
  defender sebaliknya), skor kemenangan 8 ronde, daftar kontrol lengkap, SATU tombol "Mulai" yang
  meminta pointer lock + membuat AudioContext. Judul visual mengikuti gambar menu Gito (5 robot,
  PLAY besar) — tapi tetap layar web fungsional, bukan gambar.
- Pause saat pointer lock lepas di tengah ronde: kontrol ditampilkan lagi, simulasi berhenti
  (bot ikut berhenti). Tidak ada jalan buntu UI.
- Layar akhir match: skor final, statistik (kill, mati, plant, defuse), tombol main lagi (reset
  peran, penghitung, skala akurasi bot, uang ke $800, skor 0-0).
- HUD: health bar + angka, ammo mag/cadangan, timer ronde, skor tim, uang, ikon tim hidup,
  killfeed, banner ronde, status bom (planted/defuse progress), crosshair dinamis (membesar saat
  bergerak/menembak), hitmarker, indikator arah damage. Minimap live (canvas, ~10 Hz, baca state:
  pemain/bot/bom/sites/pintu).
- Audio: WebAudio synth SEMUA (tanpa aset berhak cipta): tembakan per senjata, reload click,
  langkah kaki, plant/defuse beep, ledakan, stinger menang/kalah, hit tick, slide pintu Mid.
  AudioContext tertangguh dilanjutkan saat fokus kembali; audio tidak memblokir input; cap suara
  serentak + prioritas kedekatan.

## 9. QA — 38 ITEM BEKU + 5 TAMBAHAN AMENDEMEN (verifier memakai daftar ini)

Sumber: Final Design Specification §10 (file PDF di
~/workspace/goals/make-fun-threejs-fps-01-kejar-400/files/dustline-final-design-spec/).
Ringkasan: A1–A5 loop/ronde (termasuk 4 jalan menang masing-masing 1×, post-plant, match berakhir
tepat skor 8, 5 match bot-vs-bot tanpa gantung); B1–B8 senjata/granat/kevlar (tiap senjata tembak/
reload/mag habis/cadangan habis; damage = tabel; headshot ×2/Longbow ×4, kaki ×0,75; spread
bergerak vs diam vs crouch; Breacher 8 pellet + falloff; Longbow optik 2,5× + spread 0,050 tanpa
optik; Frag 85 di pusat + LOS + tidak tembus dinding; Smoke putus LOS bot 12 dtk; Flash buta 2,2 dtk;
kevlar ×0,65 + hilang saat mati); C1–C6 bom/ekonomi (plant hanya di zona, 3,2 dtk, aturan batal;
defuse 5,0 dtk + beep cepat 10 dtk terakhir + ledakan tepat 35,0 dtk; ledger uang 1 match penuh;
beli di luar fase/zona ditolak + harga menu = potongan; primer jatuh + F + carry-over; bot beli
sesuai tabel di 3 tingkat saldo); D1–D7 bot/map (bot tidak menembak target tak terlihat/didengar;
reaksi tembakan VK-47 di 40 m ya / 50 m tidak; langkah lari 12 m / crouch 4 m; 9 bot selesaikan
rute tanpa macet >2 dtk; playbook bom: 2 defender retake rute berbeda + 1 defuse + penyerang tahan
radius 12 m; bom jatuh diambil ≤10 dtk; tidak ada bot keluar map/menembus cover/macet di tunnel;
jarak tempuh spawn→site 12–15 dtk); E1–E4 HUD/UX/audio; F1–F? performa (FPS median ≥60, 1% low
≥45, tick ≤4 ms rata-rata/p99 ≤8 ms, buka→main ≤2 dtk, source ≤140 KiB target).
Tambahan amendemen (5): carrier plant lewat service tunnel (auto-test); carrier plant lewat Mid
Door (auto-test); defuse bot jalan dari kedua interior; tidak ada bot macet di pintu tertutup/di
dalam tunnel; screenshot ?shot= dari dalam interior tetap terbaca.
ATURAN QA: satu baris hanya dicentang dari bukti yang benar-benar dijalankan; baris belum
tercentang = fitur belum boleh diklaim ada.

## 10. DEFAULT AMB (26 AMB belum diputuskan → pakai default konsisten dengan freeze)

AMB-01 recoil non-auto tanpa akumulasi spray (P9/Breacher/Longbow). AMB-03 simpangan horizontal
acak simetris, di-reseed tiap magasin. AMB-04 ganti senjata membatalkan reload; reload ulang dari
nol. AMB-05 satu jalur kode tembak untuk pemain dan bot. AMB-07 timer granat sejak lepas tangan,
tanpa cooking. AMB-08 smoke berkembang radius linear. AMB-10 pasca-lempar kembali ke senjata
sebelumnya; ganti senjata membatalkan lemparan. AMB-12 gangguan pandang <0,12 dtk tidak mereset
keterlihatan 0,15 dtk. AMB-13 respons dengar per peran (holder menoleh, rotator menyelidiki).
AMB-14 reaksi periferal 2× reaksi peran, syarat 0,15 dtk tetap. AMB-17 pisah antar-bot 0,6 m;
prioritas ruang untuk penanam/pen-defuse. AMB-18 debug graph via ?debug=1. AMB-19 bot tidak
membeli Smoke. AMB-20 tabel beli bot per komponen terhadap carry-over. AMB-21 penghitung kalah
beruntun D2 milik tim, direset kemenangan tim. AMB-22 beli bot serentak di awal fase beli. AMB-23
defuse + ledakan di tick yang sama → ledakan menang. AMB-24 semua reward dibukukan sekali di akhir
ronde. AMB-25 satu daftar reset antar-ronde. AMB-26 "main lagi" mereset peran/penghitung/skala
akurasi bot. AMB-28 skenario bench ketiga: baku tembak Mid + Smoke. AMB-29 pool partikel/tracer
sirkular; efek pemain + ledakan bom tidak ditimpa. AMB-31 auto-repeat diabaikan; kehilangan fokus
membersihkan status tombol + pause. AMB-32 sensitivitas mouse satu nilai default di config (1,0).
AMB-33 AudioContext tertangguh dilanjutkan saat fokus kembali; audio tidak memblokir input.
AMB-34 batas suara serentak WebAudio + prioritas kedekatan.

## 11. URUTAN KERJA

1. Scaffold (subagent lain, berjalan): repo + vendor + main.ts + README + owner.json.
2. Builder A — core sim: config, state, world (+graph/A*), input, player, weapons (tanpa
   viewmodel dulu — logika tembak/reload/lempar), grenades, combat, rounds, bots. Tulis
   + uji unit logika via node (sim headless bila memungkinkan) + serve + smoke test Playwright.
3. Builder B — presentasi: characters, render, audio, hud, shots, index.html, main.js,
   viewmodel tangan robot di weapons.js. Integrasi penuh + screenshot ?shot=.
4. Verifier: Playwright (Chromium via ~/.cache/ms-playwright/chromium-1255, fallback Firefox
   firefox-1572; Playwright ada di ~/workspace/makefun-token-radar/pwtest/node_modules),
   0 console error, QA §9 satu per satu, bench ?bench=1, screenshot bukti di shots/,
   ukuran source + gate lokal (parent menjalankan main.ts + check kit).
5. Iterasi perbaikan sampai v1 layak → laporkan ke koordinator → parent bundle/check/submit
   (submit hanya atas kata Gito).
