import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { extractLookup, parseCsv, type CsvData, type Participant } from "./lib/csv";
import { beep } from "./lib/beep";
import { addCheckin, exportCsv, loadCheckins, loadOverrides, setOverride } from "./lib/store";

type ScanResult =
  | { kind: "valid"; p: Participant }
  | { kind: "duplicate"; p: Participant; at: string }
  | { kind: "unpaid"; p: Participant }
  | { kind: "not_found"; code: string };

const AUTO_HIDE_SECONDS = 10;

export default function App() {
  const [data, setData] = useState<CsvData | null>(null);
  const [csvError, setCsvError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkins, setCheckins] = useState(loadCheckins);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const scanInput = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { data: d, errors } = parseCsv(await file.text());
    if (!d) {
      setCsvError(errors.join(" "));
      return;
    }
    setCsvError("");
    setData(d);
    setResult(null);
  }

  // Ref ke handleCode terbaru supaya callback kamera tidak pakai state basi.
  const handleCode = (raw: string) => {
    if (!data) return;
    const code = raw.trim();
    if (!code) return;
    // Kamera bisa decode QR yang sama berkali-kali berturut-turut — abaikan dalam 3 dtk.
    const now = Date.now();
    if (lastScan.current.code === code && now - lastScan.current.at < 3000) return;
    lastScan.current = { code, at: now };

    const lu = extractLookup(code);
    const p = (lu.id && data.byId.get(lu.id)) || (lu.bib && data.byBib.get(lu.bib)) || null;

    if (!p) {
      setResult({ kind: "not_found", code });
      beep.err();
    } else if (checkins[p.id]) {
      setResult({ kind: "duplicate", p, at: checkins[p.id].at });
      beep.dup();
    } else if (p.paymentStatus !== "settlement" && !loadOverrides()[p.id]) {
      setResult({ kind: "unpaid", p });
      beep.warn();
    } else {
      addCheckin(p.id);
      setCheckins(loadCheckins());
      setResult({ kind: "valid", p });
      beep.ok();
    }
  };
  const handleCodeRef = useRef(handleCode);
  handleCodeRef.current = handleCode;

  function handleOverride(p: Participant) {
    setOverride(p.id);
    addCheckin(p.id);
    setCheckins(loadCheckins());
    setResult({ kind: "valid", p });
    beep.ok();
  }

  // Kamera QR (opsional — hardware scanner tetap lewat input di bawah).
  useEffect(() => {
    if (!cameraOn) return;
    const qr = new Html5Qrcode("qr-reader");
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decoded) => handleCodeRef.current(decoded),
      () => {} // decode error per-frame: abaikan
    ).catch(() => {
      setCameraError("Gagal mengakses kamera. Periksa izin browser — input scanner tetap jalan.");
      setCameraOn(false);
    });
    return () => {
      if (qr.isScanning) qr.stop().then(() => qr.clear()).catch(() => {});
    };
  }, [cameraOn]);

  // Auto-hide kartu hasil.
  useEffect(() => {
    if (!result) return;
    setCountdown(AUTO_HIDE_SECONDS);
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [result]);
  useEffect(() => {
    if (result && countdown === 0) setResult(null);
  }, [result, countdown]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-red-500">RPC Scanner</h1>
          <p className="text-slate-400 mt-3">Race Pack Collection — offline, data dari CSV</p>
        </div>
        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 active:translate-y-[2px] border-b-4 border-emerald-800 text-white font-black uppercase tracking-wider px-8 py-4 rounded-2xl transition-all">
          Pilih File CSV Peserta
          <input type="file" accept=".csv,text/csv" onChange={handleFile} hidden />
        </label>
        {csvError && <p className="text-red-400 font-bold text-center">{csvError}</p>}
        <p className="text-xs text-slate-500 text-center">
          Kolom wajib: <code>id, bib, name, category, paymentStatus</code> — opsional: <code>gender, tshirtSize</code>
        </p>
      </div>
    );
  }

  const done = Object.keys(checkins).filter((id) => data.byId.has(id)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-slate-800">
        <h1 className="font-black uppercase tracking-widest text-red-500">RPC</h1>
        <p className="text-sm text-slate-400">
          Total <b className="text-slate-100">{data.list.length}</b>
          {" · "}Check-in <b className="text-emerald-400">{done}</b>
          {" · "}Sisa <b className="text-slate-100">{data.list.length - done}</b>
        </p>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => exportCsv(data, checkins)}
            className="bg-slate-800 hover:bg-slate-700 border-b-2 border-slate-950 text-slate-200 text-sm font-bold px-4 py-2 rounded-xl transition-all"
          >
            Export Check-in
          </button>
          <button
            onClick={() => { setData(null); setResult(null); }}
            className="bg-slate-800 hover:bg-slate-700 border-b-2 border-slate-950 text-slate-200 text-sm font-bold px-4 py-2 rounded-xl transition-all"
          >
            Ganti CSV
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-8 max-w-6xl w-full mx-auto">
        <section className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-black">
            <div className="flex justify-between items-center px-4 py-2 bg-slate-900">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Kamera QR</span>
              <button
                onClick={() => { setCameraError(""); setCameraOn((v) => !v); }}
                className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-b-2 transition-all ${
                  cameraOn
                    ? "bg-red-600 hover:bg-red-500 border-red-800 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 border-emerald-800 text-white"
                }`}
              >
                {cameraOn ? "Stop" : "Start"}
              </button>
            </div>
            {cameraOn ? (
              <div id="qr-reader" className="w-full" />
            ) : (
              <div className="aspect-video flex items-center justify-center text-slate-600 text-sm font-bold">
                Kamera mati — scanner hardware tetap jalan di bawah
              </div>
            )}
          </div>
          {cameraError && <p className="text-red-400 text-sm font-bold">{cameraError}</p>}

          <input
            ref={scanInput}
            autoFocus
            placeholder="Scanner hardware / ketik BIB, lalu Enter…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCode(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
            onBlur={(e) => e.target.focus()}
            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 outline-none text-lg font-bold px-5 py-4 rounded-2xl placeholder:text-slate-600 transition-colors"
          />
        </section>

        <section className="flex-1 flex items-center justify-center min-h-[40vh]">
          {result ? <ResultCard result={result} countdown={countdown} onOverride={handleOverride} /> : (
            <p className="text-slate-600 font-black uppercase tracking-widest text-xl text-center">
              Menunggu scan…
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function Chip({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "green" | "amber" | "red" }) {
  const tones = {
    slate: "bg-slate-800 border-slate-700 text-slate-100",
    green: "bg-emerald-900/50 border-emerald-700 text-emerald-300",
    amber: "bg-amber-900/50 border-amber-700 text-amber-300",
    red: "bg-red-900/50 border-red-700 text-red-300",
  };
  return (
    <div className={`flex-1 min-w-[120px] border rounded-2xl px-4 py-3 flex flex-col items-center text-center ${tones[tone]}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-xl font-black">{value || "-"}</span>
    </div>
  );
}

function ResultCard({ result, countdown, onOverride }: { result: ScanResult; countdown: number; onOverride: (p: Participant) => void }) {
  const time = (iso: string) => new Date(iso).toLocaleTimeString("id-ID");

  if (result.kind === "not_found") {
    return (
      <div className="w-full max-w-2xl bg-red-950/60 border-2 border-red-600 rounded-3xl p-8 flex flex-col items-center gap-4">
        <h2 className="text-4xl font-black uppercase text-red-500 tracking-tight">Tidak Terdaftar</h2>
        <p className="text-red-300 font-mono text-lg break-all">{result.code}</p>
        <span className="text-slate-500 text-sm font-bold">{countdown}s</span>
      </div>
    );
  }

  const p = result.p;
  const tone =
    result.kind === "valid"
      ? { border: "border-emerald-500", bg: "bg-emerald-950/40", bib: "text-emerald-400", heading: "text-emerald-400" }
      : result.kind === "unpaid"
        ? { border: "border-amber-500", bg: "bg-amber-950/40", bib: "text-amber-400", heading: "text-amber-400" }
        : { border: "border-amber-600", bg: "bg-amber-950/40", bib: "text-amber-400", heading: "text-amber-400" };

  return (
    <div className={`w-full max-w-2xl ${tone.bg} border-2 ${tone.border} rounded-3xl p-8 flex flex-col items-center gap-6`}>
      <h2 className={`text-lg font-black uppercase tracking-widest ${tone.heading}`}>
        {result.kind === "valid" && "Terdaftar & Lunas"}
        {result.kind === "unpaid" && "Belum Bayar"}
        {result.kind === "duplicate" && `Sudah Check-in ${time(result.at)}`}
      </h2>

      <p className="text-5xl md:text-7xl font-black uppercase tracking-tight text-center leading-none break-words">
        {p.name}
      </p>

      <div className={`text-7xl md:text-8xl font-black ${tone.bib} tracking-tighter leading-none`}>{p.bib}</div>

      <div className="flex flex-wrap justify-center gap-3 w-full max-w-xl">
        <Chip label="Kategori" value={p.category} />
        <Chip label="Gender" value={p.gender} />
        <Chip label="Ukuran Kaos" value={p.tshirtSize} tone="green" />
        <Chip
          label="Status"
          value={result.kind === "valid" ? "OK" : result.kind === "unpaid" ? "UNPAID" : "DUPLIKAT"}
          tone={result.kind === "valid" ? "green" : "amber"}
        />
      </div>

      {result.kind === "unpaid" && (
        <button
          onClick={() => onOverride(p)}
          className="bg-emerald-600 hover:bg-emerald-500 active:translate-y-[2px] border-b-4 border-emerald-800 text-white font-black uppercase tracking-wider px-8 py-3 rounded-2xl transition-all"
        >
          Tandai Lunas Manual
        </button>
      )}

      <span className="text-slate-500 text-sm font-bold">{countdown}s</span>
    </div>
  );
}
