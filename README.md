# RPC Scanner

Scanner check-in Race Pack Collection — **offline**, data dari CSV, jalan di
localhost. Turunan standalone dari halaman RPC di lumpat.co.id, tanpa server,
tanpa DB, tanpa login.

## Jalankan

```bash
npm install
npm run dev        # buka http://localhost:5173
```

## Format CSV

```csv
id,bib,name,category,gender,tshirtSize,paymentStatus
3f2a1b2c-...,1017,Budi Santoso,10K,M,L,settlement
```

- `id` — UUID registrasi; QR e-ticket berisi URL `/verify/<uuid>` → dicocokkan ke kolom ini. Wajib.
- `bib`, `name`, `category`, `paymentStatus` — wajib. `paymentStatus = settlement` berarti lunas.
- `gender`, `tshirtSize` — opsional (tapi berguna saat bagi race pack).

Export dari DB lumpat:

```sql
SELECT er.id, er.bibNumber AS bib, er.name, c.name AS category,
       er.gender, er.tshirtSize, er.paymentStatus
FROM EventRegistration er JOIN Category c ON er.categoryId = c.id
WHERE er.eventId = '<uuid-event>';
```

## Cara pakai di booth

1. Buka localhost → pilih CSV → stats total/check-in/sisa tampil di header.
2. Scan: kamera QR (tombol Start) **atau** hardware scanner USB/RFID yang
   mengetik kode + Enter (input selalu fokus). Ketik BIB manual juga bisa.
3. Bip & kartu: hijau = valid (tercatat), amber = belum bayar / duplikat,
   merah = tidak terdaftar. Kartu auto-hide 10 dtk, tertimpa scan berikutnya.
4. Peserta unpaid yang bayar di tempat → tombol **Tandai Lunas Manual**.
5. Selesai acara → **Export Check-in** (CSV: siapa sudah ambil + waktu).

Check-in & override tersimpan di localStorage browser — aman me-refresh /
ganti CSV baru di tengah acara. Data per-laptop (asumsi 1 device per booth).

## Tes

```bash
npm test    # vitest — parser CSV + lookup
```
# rpc
