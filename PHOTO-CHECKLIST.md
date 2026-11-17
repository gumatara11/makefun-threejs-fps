# PHOTO CHECKLIST — EMBERLINE harus sama seperti foto Gito (JANGAN KURANG)

Perintah Gito 17 Nov 01:52 WIB: kerjakan seperti foto, MULAI DARI KARAKTER DAN KOTA, jangan ada
yang dipangkas/dilewat. Urutan: (1) karakter, (2) kota, (3) baru QA D3 + AM2, commit, check.
Foto sumber (sudah dibaca koordinator 01:53 WIB):
- Menu: ~/workspace/user/files/7257_3_q48d.jpg
- Gameplay: ~/workspace/user/files/7256_1_bnz6.jpg
- Map: ~/workspace/user/files/7255_2_llq0.jpg

Aturan: tiap item ☐ hanya dicentang dengan BUKTI screenshot yang dilihat sendiri. "Mirip" tidak
cukup — elemen harus ADA dan TERBACA. Semua desain robot ORIGINAL (jangan tiru robot game lain);
foto hanya arah visual, bukan untuk dijiplak mentah. Budget tetap: ≤180 draw calls, ≤350k tris,
≤48 MiB game/, tekstur ≤2K, material unik ≤24.

## 1. KARAKTER — 5 robot chibi (foto menu, kiri ke kanan)

- ☐ R1 KUNING: bulky/berat, armor kuning + abu gelap/hitam, helm bulat + visor, senjata BERAT
  (cannon/rifle besar), aksen oranye/kuning, kaki chunky. Paling gemuk dari kelimanya.
- ☐ R2 PINK KUCING: pink + putih, TELINGA KUCING di helm, visor/mata pink, tubuh ramping,
  memegang rifle, armor pink/putih.
- ☐ R3 BIRU TENGAH (leader, paling tinggi): biru + putih + silver, helm dengan antena/fin tinggi,
  mata/visor menyala cyan/biru, chest core menyala, shoulder pad biru, memegang rifle.
- ☐ R4 MERAH: merah + putih + hitam, helm BERTANDUK (horn), mata menyala merah/oranye,
  JUBAH/SYAL MERAH mengalir, memegang rifle panjang, armor merah/putih.
- ☐ R5 HIJAU: hijau + putih, helm bulat + visor hijau, aksen teal/hijau, tubuh ramping, memegang rifle.
- ☐ Kelimanya TERBEDAKAN dari jarak main (bukan 5 kotak abu-abu yang sama): warna + siluet
  (fin/telinga kucing/antena/horn/visor) terbaca dari ±20 m.
- ☐ Setiap robot MEMEGANG SENJATA di tangannya (senjata terlihat, bukan tangan kosong).
- ☐ Drone kecil melayang (foto menu, tengah atas): drone bundar kecil berwajah, biru/putih,
  melayang di atas arena (prop ambient, bukan musuh).
- ☐ Warna tim tetap terbaca: penyerang = visor/stripe/panel ORANYE, defender = BIRU (di atas warna
  individu masing-masing robot). Pembawa bom = panel ransel + lampu beep berkedip.
- ☐ TANGAN ROBOT first-person (foto gameplay: senjata pink/biru + tangan): jari metal terang
  bersegmen yang MEMBUNGKUS grip/foregrip (bukan batang mengambang, bukan kotak hitam),
  cuff warna tim menyentuh jari tanpa gap, lengan lathe + ring. Verifikasi zoom idle + reload
  untuk P9 DAN VK-47 (tangan kanan VK-47 harus TERLIHAT memegang grip).
- ☐ 5 robot tampil di LAYAR AWAL (menu): baris figure robot di atas/di samping tombol PLAY,
  bukan hanya gradien + teks. (Boleh render scene yang sama dari kamera menu.)
- ☐ Senjata first-person BERWARNA seperti foto gameplay (aksen pink/biru pada SMG/rifle),
  bukan hitam polos. Ammo + muzzle flash terbaca.

## 2. KOTA — kota anime terang (foto map + foto gameplay)

- ☐ Langit BIRU CERAH + awan putih + matahari (bukan abu-abu mendung). Awan = gumpalan putih,
  bukan blob abu-abu.
- ☐ MENARA CINCIN: menara tinggi di tengah kejauhan dengan cincin menyala + logo segitiga,
  terlihat dari Mid/lane terbuka.
- ☐ JEMBATAN penyeberang di atas Mid (logam + railing + tangga, seperti foto map tengah) —
  prop visual di atas lane (bukan jalur jalan; tanpa collision naik).
- ☐ POHON SAKURA: ≥6 pohon (kanopi pink berlapis + batang coklat) tersebar di map — di spawn,
  di Mid, di dekat site — BUKAN hanya 1–2 pohon. Kelopak pink JATUH (partikel) + kelopak di tanah.
- ☐ SITE A MERAH: kontainer MERAH dengan huruf "A" putih BESAR + garis lantai oranye + crate
  kuning/abu. Terbaca sebagai zona merah dari jauh.
- ☐ SITE B BIRU: bangunan/tangki BIRU dengan huruf "B" putih BESAR + garis lantai biru.
- ☐ NEON: strip neon cyan/magenta di bangunan + papan tanda "EMBERLINE" menyala + trim neon
  di tepi bangunan (foto map kanan + foto gameplay bangunan putih trim hijau).
- ☐ KONTENER + CRATE bertanda: kontainer/crate dengan strip kuning hazard + label A/B,
  bukan kotak abu-abu polos.
- ☐ JALAN: tile terang + MARKA KUNING (garis + panah) di tengah lane + trotoar + planter
  hijau/semak + bangku + skuter/sepeda parkir (prop foto gameplay) + genangan/refleksi ringan.
- ☐ BANGUNAN KOTA: gedung futuristik putih/abu terang + jendela bercahaya + trim warna di
  sekeliling map (skyline), bukan dinding abu-abu polos tanpa detail.
- ☐ Kendaraan terbang kecil (airship) di langit jauh (foto map kanan atas) — prop ambient.
- ☐ Interior Site A/B tetap ada (gudang/bengkel beratap + props) + service tunnel + Mid Door —
  elemen amendemen TIDAK boleh hilang saat kota diperkaya.
- ☐ Semua elemen di atas ADA dalam SATU screenshot cover (1-action.jpg): sakura + kota + neon +
  musuh robot terbaca — cover harus menjual game dalam 1 detik.

## 3. SETELAH KARAKTER + KOTA — baru QA + check (urutan Gito)

- ☐ D3: bot D5/D4 tidak macet >2 dtk (separate() sadar collision + unstuck/repath).
- ☐ AM2: DIPUTUSKAN — terima service tunnel sebagai rute utama (A* memilih rute terpendek =
  benar; pintu terbukti berfungsi). Hanya catat keputusan di bots.js + laporan. JANGAN
  kerjakan ulang routing.
- ☐ Commit semua perubahan + push.
- ☐ Kit check 0 failed (repo gate + transcripts via bundle parent).
- ☐ Lapor dengan screenshot bukti karakter + kota.
