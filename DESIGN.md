---
tokens:
  colors:
    bg: slate-950
    surface: slate-900
    border: slate-800
    accent: red-500
    ok: emerald-500
    warn: amber-500
    error: red-600
  typography:
    display: font-black uppercase tracking-tight (nama text-5xl/7xl, BIB text-7xl/8xl)
    label: text-xs font-bold uppercase tracking-widest
  radius: rounded-2xl (controls) / rounded-3xl (cards)
---

# RPC Scanner — Design

Tool internal booth Race Pack Collection: gelap, kontras tinggi, terbaca
dari jarak 1–2 m. Layout dua kolom (kamera + input scanner di kiri, kartu
hasil besar di kanan), stack vertikal di layar sempit.

Warna status adalah bahasa utamanya: hijau = valid, amber = unpaid/duplikat,
merah = tidak terdaftar. Bip (Web Audio) membedakan keempatnya supaya
operator tidak wajib menatap layar. Netral slate gelap + aksen merah
mengikuti identitas halaman RPC lumpat.co.id.
