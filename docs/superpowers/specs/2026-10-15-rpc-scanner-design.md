# RPC Scanner — Design Spec (2026-10-15)

Standalone offline check-in scanner untuk booth Race Pack Collection (RPC)
lumpat.co.id. Disetujui dalam brainstorming 2026-10-15.

## Keputusan

| Keputusan | Pilihan |
| --- | --- |
| Lokasi | `C:\project\rpc` — project terpisah, bukan di dalam repo lumpat |
| Stack | Vite + React 19.3 + TypeScript + Tailwind v4, tanpa backend |
| Data | CSV via file input; format didefinisikan sendiri |
| Scan | Kamera QR (html5-qrcode) + input selalu-fokus untuk hardware scanner |
| QR payload | URL `/verify/<uuid>` → match kolom `id`; fallback BIB |
| Feedback | Nada Web Audio per status + kartu warna + auto-hide 10 dtk |
| Pencatatan | localStorage (check-in + override), Export CSV hasil |
| Devices | 1 laptop per booth → localStorage cukup, tanpa sinkronisasi |
| Override | Tombol "Tandai Lunas Manual" di kartu unpaid |

## Status scan

- **valid** — `paymentStatus = settlement` (atau sudah di-override), belum
  check-in → bip naik, kartu hijau, check-in tercatat.
- **duplicate** — sudah check-in → 2 bip rendah, kartu amber + jam check-in.
- **unpaid** — bukan `settlement` dan belum di-override → bip square rendah,
  kartu amber + tombol override.
- **not_found** — tidak ada di CSV → bip error, kartu merah + kode mentah.

## Struktur

```
src/
  App.tsx        — upload CSV → layar scan → kartu hasil
  lib/csv.ts     — PapaParse + index byId/byBib + extractLookup (UUID/BIB)
  lib/beep.ts    — Web Audio tones (ok/dup/warn/err)
  lib/store.ts   — localStorage check-ins/overrides + export CSV
  lib/csv.test.ts— vitest: parsing, kolom wajib, lookup
```

## Edge cases

- Kamera decode QR sama berulang → debounce kode identik 3 dtk.
- Reload/ganti CSV di tengah acara → check-in & override tetap (localStorage,
  key by UUID peserta).
- Kamera ditolak → pesan error, input hardware tetap berfungsi.
- CSV kurang kolom wajib → pesan kolom yang hilang, tidak masuk layar scan.
- Nama dengan koma → CSV quoted (ditangani PapaParse; sample ada di tes).

## Non-goals

- Sinkronisasi antar device (butuh server kecil — tambah hanya jika booth
  multi-device jadi nyata).
- Search by nama (operator pegang tiket fisik, BIB selalu ada).
- Deploy/deploy-target apa pun — localhost saja.
