import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  extractLookup,
  type CsvData,
  type Participant,
} from "../lib/csv";
import { beep } from "../lib/beep";
import {
  addCheckin,
  loadCheckins,
  loadOverrides,
  setOverride,
  clearCheckins,
} from "../lib/store";
import { useRfidBridge } from "../lib/rfidBridge";
import {
  type AppSettings,
  type DisplayOrientation,
  buildIdleSrcdoc,
  saveSettings,
} from "../lib/settings";

// ─── Types ────────────────────────────────────────────────────────────────────
type ScanResult =
  | { kind: "valid"; p: Participant }
  | { kind: "duplicate"; p: Participant; at: string }
  | { kind: "unpaid"; p: Participant }
  | { kind: "not_found"; code: string };

type Phase =
  | "idle"      // Showing idle iframe — waiting for scan
  | "entering"  // Curtain slides up (600ms)
  | "scanned"   // "TERSCAN" flash (700ms)
  | "loading"   // Step animation (4 × 450ms)
  | "result"    // Result display (holdSeconds)
  | "leaving";  // Curtain slides down (600ms)

const LOADING_STEPS = [
  "Membaca kartu RFID…",
  "Mencari data peserta…",
  "Verifikasi status registrasi…",
  "Menampilkan hasil…",
];
const STEP_MS = 450;
const TOTAL_LOADING_MS = LOADING_STEPS.length * STEP_MS; // 1800ms
const SCANNED_MS = 700;
const ENTERING_MS = 600;
const LEAVING_MS = 600;

// ─── Component ────────────────────────────────────────────────────────────────
export default function DisplayMode({
  data,
  settings,
  onExit,
}: {
  data: CsvData | null;
  settings: AppSettings;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [checkins, setCheckins] = useState(loadCheckins);
  const processingRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scanInput = useRef<HTMLInputElement>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const { design } = settings;

  // ─── Orientation Detection & Handling ────────────────────────────────────
  const [deviceIsPortrait, setDeviceIsPortrait] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < window.innerHeight;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setDeviceIsPortrait(window.innerWidth < window.innerHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDevMode = settings.devMode ?? false;

  const [orientationMode, setOrientationMode] = useState<DisplayOrientation>(
    design.orientation ?? "auto"
  );
  const [kioskFitMode, setKioskFitMode] = useState<"totem" | "stretch">(
    design.kioskFitMode ?? "totem"
  );

  const isPortrait =
    orientationMode === "portrait"
      ? true
      : orientationMode === "landscape"
      ? false
      : deviceIsPortrait;

  const cycleOrientation = () => {
    const next: DisplayOrientation =
      orientationMode === "auto"
        ? "portrait"
        : orientationMode === "portrait"
        ? "landscape"
        : "auto";
    setOrientationMode(next);
    saveSettings({
      ...settings,
      design: { ...design, orientation: next },
    });
  };

  // ─── Fullscreen & Escape Key ──────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});

    const onFsChange = () => {
      if (!document.fullscreenElement) onExit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };

    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {});
    };
  }, [onExit]);

  // ─── Keep hidden input focused (hardware USB scanner) ────────────────────
  useEffect(() => {
    const focus = () => scanInput.current?.focus();
    focus();
    document.addEventListener("click", focus);
    return () => document.removeEventListener("click", focus);
  }, []);

  // ─── Clear all pending timers ─────────────────────────────────────────────
  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function addTimer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }

  // ─── Process a scanned code → lookup → result ─────────────────────────────
  function resolveCode(raw: string): ScanResult {
    if (!data) return { kind: "not_found", code: raw };
    const lu = extractLookup(raw);
    const displayCode = lu.cleanedCode || raw.trim();

    const p =
      (lu.epc && data.byEpc?.get(lu.epc.toUpperCase())) ||
      (lu.epc && data.byEpc?.get(lu.epc.toLowerCase())) ||
      (lu.id && data.byId?.get(lu.id.toLowerCase())) ||
      (lu.bib && data.byBib?.get(lu.bib.toLowerCase())) ||
      data.byEpc?.get(displayCode.toUpperCase()) ||
      data.byId?.get(displayCode.toLowerCase()) ||
      data.byBib?.get(displayCode.toLowerCase()) ||
      null;

    if (!p) return { kind: "not_found", code: displayCode };

    const status = (p.paymentStatus || "").toLowerCase();
    const isUnpaid = status && status !== "settlement" && status !== "lunas" && status !== "paid";
    if (isUnpaid) {
      return { kind: "unpaid", p };
    }

    if (checkins[p.id]) return { kind: "duplicate", p, at: checkins[p.id].at };

    addCheckin(p.id);
    setCheckins(loadCheckins());
    return { kind: "valid", p };
  }

  // ─── Scan flow state machine ──────────────────────────────────────────────
  const startScanFlow = useCallback(
    (raw: string) => {
      if (processingRef.current) return;

      // Debounce same code within 3s
      const now = Date.now();
      if (
        lastScan.current.code === raw &&
        now - lastScan.current.at < 3000
      )
        return;
      lastScan.current = { code: raw, at: now };

      processingRef.current = true;
      clearTimers();
      setLoadingStep(0);

      // 1. Entering (curtain up)
      setPhase("entering");

      // 2. Scanned flash
      addTimer(() => setPhase("scanned"), ENTERING_MS);

      // 3. Loading steps
      addTimer(() => {
        setPhase("loading");
        setLoadingStep(0);
        for (let i = 1; i < LOADING_STEPS.length; i++) {
          addTimer(() => setLoadingStep(i), i * STEP_MS);
        }
      }, ENTERING_MS + SCANNED_MS);

      // 4. Show result
      addTimer(() => {
        const r = resolveCode(raw);
        setResult(r);
        setPhase("result");
        setCountdown(
          r.kind === "not_found" ? 5 : design.holdSeconds
        );

        // Audio feedback
        if (r.kind === "valid") beep.ok();
        else if (r.kind === "unpaid") beep.warn();
        else if (r.kind === "duplicate") beep.dup();
        else beep.err();
      }, ENTERING_MS + SCANNED_MS + TOTAL_LOADING_MS + 100);
    },
    [data, checkins, design.holdSeconds]
  );

  const startScanFlowRef = useRef(startScanFlow);
  startScanFlowRef.current = startScanFlow;

  // ─── RFID SSE bridge ──────────────────────────────────────────────────────
  useRfidBridge((code) => startScanFlowRef.current(code), true);

  // ─── Hardware USB scanner (keyboard-mode) ─────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const v = e.currentTarget.value.trim();
      e.currentTarget.value = "";
      if (v) startScanFlowRef.current(v);
    }
  }

  // ─── Countdown & auto-return ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "result") return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          // Trigger leaving
          setPhase("leaving");
          addTimer(() => {
            setPhase("idle");
            setResult(null);
            processingRef.current = false;
          }, LEAVING_MS);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Handle override (mark as paid) ──────────────────────────────────────
  function handleOverride(p: Participant) {
    setOverride(p.id);
    addCheckin(p.id);
    setCheckins(loadCheckins());
    setResult({ kind: "valid", p });
    beep.ok();
    // Reset countdown
    setCountdown(design.holdSeconds);
  }

  // ─── Idle srcdoc ──────────────────────────────────────────────────────────
  const idleSrcdoc = buildIdleSrcdoc(design, isPortrait ? "portrait" : "landscape");

  // ─── Overlay visibility ───────────────────────────────────────────────────
  const showOverlay = phase !== "idle";

  return (
    <div
      className={`fixed inset-0 overflow-hidden bg-slate-950 flex items-center justify-center select-none ${
        isPortrait ? "orientation-portrait" : "orientation-landscape"
      }`}
    >
      {/* ── Ambient Spotlight Backdrop for Totem Kiosk Theater ──────── */}
      {isPortrait && !deviceIsPortrait && kioskFitMode === "totem" && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.18)_0%,rgba(15,23,42,0.96)_70%)] pointer-events-none" />
      )}

      {/* ── Kiosk Totem Stage / Screen Container ─────────────────────── */}
      <div
        className={`relative h-full overflow-hidden transition-all duration-300 ${
          isPortrait && !deviceIsPortrait && kioskFitMode === "totem"
            ? "w-[min(100vw,calc(100vh*9/16))] shadow-[0_0_100px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.12)] border-x border-slate-800 bg-white"
            : "w-full bg-white"
        }`}
      >
        {/* ── Hidden keyboard scanner input ──────────────────────────── */}
        <input
          ref={scanInput}
          onKeyDown={handleKeyDown}
          onBlur={(e) => e.target.focus()}
          className="fixed opacity-0 pointer-events-none w-0 h-0"
          aria-hidden="true"
          autoComplete="off"
        />

        {/* ── Idle iframe — always rendered underneath ──────────────── */}
        <iframe
          key={`${orientationMode}-${isPortrait ? "portrait" : "landscape"}-${kioskFitMode}`}
          srcDoc={idleSrcdoc}
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts"
          title="idle-display"
        />

        {/* ── Scan overlay — slides over idle ──────────────────────── */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            showOverlay ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ background: design.resultBg }}
        >
          {/* Custom CSS injection */}
          {design.resultCustomCss && (
            <style>{design.resultCustomCss}</style>
          )}

          {/* Phase content */}
          {phase === "entering" && <EnteringContent />}
          {phase === "scanned" && <ScannedContent isPortrait={isPortrait} />}
          {phase === "loading" && <LoadingContent step={loadingStep} isPortrait={isPortrait} />}
          {(phase === "result" || phase === "leaving") && result && (
            <ResultContent
              result={result}
              design={design}
              countdown={countdown}
              onOverride={handleOverride}
              isPortrait={isPortrait}
            />
          )}
        </div>
      </div>

      {/* ── Top-right Toolbar (Developer Mode vs Clean Kiosk) ──────── */}
      {phase === "idle" && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2">
          {isDevMode ? (
            <>
              {/* Quick Orientation Switcher Button (Dev Mode only) */}
              <button
                onClick={cycleOrientation}
                className="text-[11px] font-bold text-slate-700 bg-white/95 hover:bg-white border border-slate-200/90 shadow-md px-3.5 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Klik untuk mengganti orientasi (Auto / Portrait 9:16 / Landscape 16:9)"
              >
                <span>{isPortrait ? "📱" : "🖥️"}</span>
                <span className="uppercase tracking-wider">
                  {orientationMode === "auto"
                    ? `Auto (${isPortrait ? "Portrait" : "Landscape"})`
                    : orientationMode === "portrait"
                    ? "Portrait (9:16)"
                    : "Landscape (16:9)"}
                </span>
                <span className="text-slate-400 text-[10px] ml-0.5">🔄</span>
              </button>

              {/* Kiosk Mode Toggle (Only visible in Portrait on Landscape monitor in Dev Mode) */}
              {isPortrait && !deviceIsPortrait && (
                <button
                  onClick={() => setKioskFitMode((m) => (m === "totem" ? "stretch" : "totem"))}
                  className="text-[11px] font-bold text-slate-700 bg-white/95 hover:bg-white border border-slate-200/90 shadow-md px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Toggle antara format Totem 9:16 atau Layar Penuh"
                >
                  <span>{kioskFitMode === "totem" ? "📱 Totem (9:16)" : "↔️ Stretch Full"}</span>
                </button>
              )}

              <button
                onClick={onExit}
                className="text-slate-700 hover:text-slate-900 text-xs font-bold bg-white/95 hover:bg-white border border-slate-200/90 shadow-md px-4 py-2 rounded-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                title="Kembali ke Pengaturan"
              >
                ⚙ Settings
              </button>
            </>
          ) : (
            /* Clean Kiosk Mode: Completely clean with subtle, invisible corner exit button on hover */
            <button
              onClick={onExit}
              className="opacity-0 hover:opacity-60 transition-opacity duration-300 text-slate-400 hover:text-slate-800 text-[10px] font-bold uppercase tracking-wider bg-white/80 hover:bg-white border border-slate-200/80 shadow-xs px-2.5 py-1 rounded-lg backdrop-blur-sm cursor-pointer select-none"
              title="Keluar Kiosk (atau tekan Esc)"
            >
              ✕ Keluar
            </button>
          )}
        </div>
      )}

      {/* ── Interactive Simulation Drawer (Dev Mode only) ──────────── */}
      {isDevMode && (
        <SimulationDrawer
          data={data}
          checkins={checkins}
          onScan={(code) => startScanFlowRef.current(code)}
          onResetCheckins={() => {
            clearCheckins();
            setCheckins({});
          }}
        />
      )}
    </div>
  );
}

// ─── Entering: Curtain just slid up, brief moment ─────────────────────────────
function EnteringContent() {
  return (
    <div className="flex items-center justify-center">
      <div className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
    </div>
  );
}

// ─── Scanned: "TERSCAN" big flash in Lumpat Red ──────────────────────────────
function ScannedContent({ isPortrait }: { isPortrait: boolean }) {
  return (
    <div
      className="flex flex-col items-center gap-6 px-4 text-center"
      style={{ animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      <div className="relative">
        <div className="absolute -inset-10 bg-red-500/10 blur-3xl rounded-full" />
        <div
          className={`relative font-display leading-none tracking-widest text-red-600 ${
            isPortrait ? "text-[18vw] sm:text-[90px]" : "text-[11vw]"
          }`}
          style={{
            animation: "scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
            textShadow: "0 10px 40px rgba(220,38,38,0.25)",
          }}
        >
          TERSCAN
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/90 border border-slate-200 shadow-sm backdrop-blur-md">
        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
        <span className="text-xs font-bold tracking-widest text-slate-800 uppercase">
          LUMPAT RFID SYSTEM
        </span>
      </div>
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.85); opacity: 0; filter: blur(6px); }
          to   { transform: scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Loading: step-by-step (Apple Clean Light) ────────────────────────────────
function LoadingContent({ step, isPortrait }: { step: number; isPortrait: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-8 w-full px-6 ${isPortrait ? "max-w-md" : "max-w-lg"}`}>
      {/* Precision Apple-grade Red Spinner */}
      <div className="relative w-18 h-18 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-red-600 border-r-rose-400"
          style={{ animation: "spin 0.85s linear infinite" }}
        />
        <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.5)]" />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Steps List */}
      <div className="w-full flex flex-col gap-2.5 bg-white/95 backdrop-blur-2xl border border-slate-200/90 p-5 rounded-3xl shadow-xl">
        {LOADING_STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 ${
              i === step
                ? "bg-red-50 border border-red-200 text-red-700 shadow-sm"
                : i < step
                ? "bg-slate-50 text-slate-400"
                : "opacity-35 text-slate-400"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                  ? "bg-red-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span
              className={`font-semibold tracking-wide text-sm transition-all duration-300 ${
                i === step
                  ? "text-red-700 font-bold"
                  : i < step
                  ? "text-slate-500 line-through"
                  : "text-slate-400"
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Result: Full display (Apple Light Aesthetic) ─────────────────────────────
function formatGender(gender: string): string {
  const g = gender.trim().toLowerCase();
  if (g === "m" || g === "male" || g === "pria") return "Male / Pria";
  if (g === "f" || g === "female" || g === "wanita") return "Female / Wanita";
  return gender;
}

function ResultContent({
  result,
  design,
  countdown,
  onOverride,
  isPortrait,
}: {
  result: ScanResult;
  design: AppSettings["design"];
  countdown: number;
  onOverride: (p: Participant) => void;
  isPortrait: boolean;
}) {
  const holdSec =
    result.kind === "not_found" ? 5 : design.holdSeconds;
  const pct = countdown / holdSec;

  // ── NOT FOUND ──────────────────────────────────────────────
  if (result.kind === "not_found") {
    return (
      <div
        className="flex flex-col items-center gap-6 w-full h-full justify-center px-6"
        style={{ animation: "revealResult 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <style>{revealKeyframes}</style>
        <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 text-3xl shadow-lg shadow-red-500/10">
          ✕
        </div>
        <div className={`${isPortrait ? "text-[8vw] sm:text-[44px]" : "text-[5.5vw]"} text-red-600 font-display tracking-widest result-status leading-none text-center`}>
          TIDAK TERDAFTAR
        </div>
        <div className="text-sm font-mono tracking-wider px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
          Kode RFID / BIB: <span className="text-slate-900 font-bold">{result.code}</span>
        </div>
        <p className="text-slate-500 text-sm max-w-md text-center">
          Data tidak ditemukan di master data sistem. Silakan laporkan ke meja registrasi panitia.
        </p>
        <CountdownBar pct={pct} color="#dc2626" countdown={countdown} isPortrait={isPortrait} />
      </div>
    );
  }

  const p = result.p;
  const isValid = result.kind === "valid";
  const isUnpaid = result.kind === "unpaid";
  const isDuplicate = result.kind === "duplicate";

  let statusLabel = "";
  if (isValid) {
    statusLabel = "TERDAFTAR & LUNAS";
  } else if (isUnpaid) {
    statusLabel = "BELUM LUNAS";
  } else if (isDuplicate) {
    const formattedTime = result.at ? new Date(result.at).toLocaleTimeString("id-ID") : "";
    statusLabel = `SUDAH CHECK-IN ${formattedTime ? `• ${formattedTime}` : ""}`;
  }

  const statusColor = isValid ? "#10b981" : isUnpaid ? "#dc2626" : "#f59e0b";
  const bibDisplayColor = isValid ? design.bibColor : isUnpaid ? "#dc2626" : "#f59e0b";

  return (
    <div className={`flex items-center justify-center w-full h-full ${isPortrait ? "px-4 py-8" : "px-6 py-8"}`}>
      <div
        className={`result-bib-card relative flex flex-col items-center justify-center w-full mx-auto bg-white/95 border border-slate-200/90 shadow-2xl backdrop-blur-xl ${
          isPortrait
            ? "max-w-lg min-h-[72vh] px-6 sm:px-8 py-10 justify-between gap-5 rounded-[40px]"
            : "max-w-4xl px-8 md:px-14 py-8 md:py-10 gap-4 rounded-3xl"
        }`}
        style={{ animation: "revealResult 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <style>{revealKeyframes}</style>

        {/* Lumpat Event header pill */}
        {design.showEventName && design.eventName && (
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/90 border border-slate-200 shadow-sm backdrop-blur-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span className={`${isPortrait ? "text-[12px] tracking-[0.2em]" : "text-[1.1vw] tracking-[0.3em]"} font-bold uppercase text-slate-600 text-center`}>
              {design.eventName}
            </span>
          </div>
        )}

        {/* Status Pill */}
        {design.showStatus && (
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider"
            style={{
              background: isValid ? "#ecfdf5" : isUnpaid ? "#fef2f2" : "#fffbeb",
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
            <span>{statusLabel}</span>
          </div>
        )}

        {/* Participant Name (Apple Clean Typography) */}
        {design.showName && p.name && (
          <div
            className={`font-bold leading-tight text-center break-words tracking-tight result-name ${
              isPortrait
                ? "text-3xl sm:text-4xl md:text-5xl max-w-[90%] my-2"
                : "text-[6.5vw] md:text-[5.5vw] max-w-[85vw] mt-2"
            }`}
            style={{ color: design.nameColor }}
          >
            {p.name}
          </div>
        )}

        {/* BIB Number (Vibrant Lumpat Red) */}
        {design.showBib && p.bib && (
          <div
            className={`font-display leading-none tracking-tight result-bib select-none ${
              isPortrait
                ? "text-[26vw] sm:text-[140px] md:text-[160px] my-3"
                : "text-[18vw] my-1"
            }`}
            style={{
              color: bibDisplayColor,
              filter: `drop-shadow(0 15px 35px ${bibDisplayColor}25)`,
            }}
          >
            {p.bib}
          </div>
        )}

        {/* Chips: Kategori & Gender & T-shirt */}
        <div className="flex gap-3 sm:gap-4 flex-wrap justify-center mt-2 w-full">
          {design.showCategory && p.category && (
            <ResultChip label="Kategori Lomba" value={p.category} isPortrait={isPortrait} />
          )}
          {design.showGender && p.gender && (
            <ResultChip
              label="Gender"
              isPortrait={isPortrait}
              value={formatGender(p.gender)}
            />
          )}
          {design.showTshirtSize && p.tshirtSize && (
            <ResultChip label="Ukuran Kaos" value={p.tshirtSize} isPortrait={isPortrait} />
          )}
        </div>

        {/* Optional RFID / EPC Code */}
        {design.showEpc && p.epc && (
          <div className="text-[11px] font-mono text-slate-400 mt-0.5 select-all bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-full">
            EPC: {p.epc}
          </div>
        )}

        {/* Unpaid override button if needed */}
        {isUnpaid && (
          <button
            onClick={() => onOverride(p)}
            className="mt-2 px-6 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            Tandai Lunas & Check-in Sekarang
          </button>
        )}
      </div>

      {/* Countdown bar */}
      <CountdownBar pct={pct} color={statusColor} countdown={countdown} isPortrait={isPortrait} />
    </div>
  );
}

// ─── Countdown bar (Apple Light) ──────────────────────────────────────────────
function CountdownBar({
  pct,
  color,
  countdown,
  isPortrait,
}: {
  pct: number;
  color: string;
  countdown: number;
  isPortrait?: boolean;
}) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 ${isPortrait ? "px-6 pb-6" : "px-10 pb-7"} flex items-center gap-5`}>
      <div className="flex-1 h-2 bg-slate-200/90 rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-1000 linear"
          style={{
            width: `${pct * 100}%`,
            background: `linear-gradient(90deg, #dc2626, ${color})`,
            boxShadow: `0 0 10px ${color}60`,
          }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono font-semibold tracking-wider">
        <span>AUTO-IDLE</span>
        <span className="text-slate-900 font-bold w-6 text-right">{countdown}s</span>
      </div>
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function ResultChip({ label, value, isPortrait }: { label: string; value: string; isPortrait?: boolean }) {
  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl ${isPortrait ? "px-5 py-2.5 min-w-[120px]" : "px-7 py-3"} text-center shadow-sm result-chip transition-transform hover:scale-105`}>
      <div className={`${isPortrait ? "text-[10px]" : "text-[0.65vw]"} font-bold uppercase tracking-widest text-slate-400`}>
        {label}
      </div>
      <div className={`${isPortrait ? "text-lg sm:text-xl" : "text-[1.7vw]"} font-extrabold text-slate-900 mt-0.5 tracking-tight`}>{value}</div>
    </div>
  );
}

// ─── Shared keyframes ─────────────────────────────────────────────────────────
const revealKeyframes = `
@keyframes revealResult {
  0%   { opacity: 0; transform: scale(0.95) translateY(16px); filter: blur(6px); }
  60%  { opacity: 1; transform: scale(1.01); filter: blur(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
`;

// ─── Simulation Drawer (Floating Control for Easy Testing) ─────────────────────
function SimulationDrawer({
  data,
  checkins,
  onScan,
  onResetCheckins,
}: {
  data: CsvData | null;
  checkins: Record<string, { at: string }>;
  onScan: (code: string) => void;
  onResetCheckins: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [customBib, setCustomBib] = useState("");
  const [isLooping, setIsLooping] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const [search, setSearch] = useState("");

  const participants = data?.list ?? [];
  const checkinCount = Object.keys(checkins).length;

  const filtered = search.trim()
    ? participants.filter(
        (p) =>
          p.bib.includes(search.trim()) ||
          p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          p.category.toLowerCase().includes(search.trim().toLowerCase())
      )
    : participants;

  useEffect(() => {
    if (!isLooping || participants.length === 0) return;
    const timer = setInterval(() => {
      setLoopIndex((prev) => {
        const next = (prev + 1) % participants.length;
        const p = participants[next];
        if (p) onScan(p.bib);
        return next;
      });
    }, 7000);
    return () => clearInterval(timer);
  }, [isLooping, participants, onScan]);

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (customBib.trim()) {
      onScan(customBib.trim());
      setCustomBib("");
    }
  }

  const panelStyle: React.CSSProperties = {
    width: "400px",
    maxHeight: "82vh",
    overflowY: "auto",
    background: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(24px)",
    border: "1px solid rgba(226,232,240,0.9)",
    borderRadius: "28px",
    padding: "20px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    color: "#1e293b",
  };

  return (
    <div style={{ position: "fixed", bottom: "20px", left: "20px", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", userSelect: "none", fontFamily: "system-ui, sans-serif" }}>
      {isOpen && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
              <span style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a", letterSpacing: "-0.02em" }}>🎮 Simulator RPC Scanner</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "4px 8px", cursor: "pointer" }}
            >
              ✕ Tutup
            </button>
          </div>

          {/* Progress Counter */}
          <div style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)", border: "1px solid #fecaca", borderRadius: "16px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Progress Check-in</div>
              <div style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>
                {checkinCount}
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginLeft: "4px" }}>/ {participants.length} peserta</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              <div style={{ width: "100px", height: "6px", background: "#fee2e2", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: participants.length > 0 ? `${(checkinCount / participants.length) * 100}%` : "0%", background: "linear-gradient(90deg, #ef4444, #dc2626)", borderRadius: "99px", transition: "width 0.4s ease" }} />
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626" }}>
                {participants.length > 0 ? Math.round((checkinCount / participants.length) * 100) : 0}% selesai
              </span>
            </div>
          </div>

          {/* Demo Loop */}
          <div style={{ background: isLooping ? "#fef2f2" : "#f8fafc", border: `1px solid ${isLooping ? "#fca5a5" : "#e2e8f0"}`, borderRadius: "14px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.3s ease" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: isLooping ? "#dc2626" : "#475569" }}>⚡ Demo Loop Otomatis</div>
              <div style={{ fontSize: "10px", color: isLooping ? "#ef4444" : "#94a3b8", marginTop: "2px" }}>Scan bergantian setiap 7 detik</div>
            </div>
            <button
              onClick={() => setIsLooping(!isLooping)}
              style={{ padding: "6px 14px", borderRadius: "10px", fontSize: "11px", fontWeight: 800, border: isLooping ? "none" : "1px solid #fca5a5", background: isLooping ? "#dc2626" : "#fff", color: isLooping ? "#fff" : "#dc2626", cursor: "pointer", transition: "all 0.2s ease" }}
            >
              {isLooping ? "⏹ Stop" : "▶ Start"}
            </button>
          </div>

          {/* Custom BIB Input */}
          <form onSubmit={handleCustomSubmit} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={customBib}
              onChange={(e) => setCustomBib(e.target.value)}
              placeholder="Ketik BIB atau UUID manual..."
              style={{ flex: 1, background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "8px 12px", fontSize: "12px", color: "#1e293b", outline: "none" }}
            />
            <button
              type="submit"
              style={{ background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: "12px", border: "none", borderRadius: "12px", padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              📡 Scan
            </button>
          </form>

          <div style={{ borderTop: "1px solid #f1f5f9" }} />

          {/* Search + Participant List */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
              Pilih Peserta &middot; {filtered.length} dari {participants.length}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari nama, BIB, atau kategori..."
              style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "8px 12px", fontSize: "12px", color: "#1e293b", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto", paddingRight: "2px" }}>
              {filtered.map((p) => {
                const isCheckedIn = Boolean(checkins[p.id]);
                const gender = p.gender === "M" || p.gender?.toLowerCase() === "male" ? "M" : "F";
                return (
                  <button
                    key={p.id}
                    onClick={() => onScan(p.bib)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: isCheckedIn ? "1.5px solid #86efac" : "1.5px solid #e2e8f0",
                      background: isCheckedIn ? "rgba(240,253,244,0.8)" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                      <span style={{ fontWeight: 900, fontSize: "14px", color: "#dc2626", flexShrink: 0 }}>#{p.bib}</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "2px 6px" }}>
                        {p.category} &middot; {gender}
                      </span>
                      {isCheckedIn ? (
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "6px", padding: "2px 6px" }}>✓ Scan</span>
                      ) : (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "2px 6px" }}>Belum</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: "12px", fontWeight: 600 }}>
                  Peserta tidak ditemukan
                </div>
              )}
              {!search && (
                <button
                  onClick={() => onScan("9999")}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "12px", border: "1.5px dashed #cbd5e1", background: "#f8fafc", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease" }}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>👤 Scan Tidak Terdaftar (#9999)</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", borderRadius: "6px", padding: "2px 6px", border: "1px solid #e2e8f0" }}>Not Found</span>
                </button>
              )}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={onResetCheckins}
            style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", textAlign: "center", padding: "4px" }}
          >
            🔄 Reset Semua Status Check-in
          </button>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.97)", color: "#1e293b", border: "1px solid rgba(226,232,240,0.9)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", padding: "10px 16px", borderRadius: "18px", fontSize: "12px", fontWeight: 800, backdropFilter: "blur(16px)", cursor: "pointer" }}
      >
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
        <span>🎮 Simulator RPC</span>
        {checkinCount > 0 && (
          <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: "#dc2626", color: "#fff" }}>
            {checkinCount}/{participants.length}
          </span>
        )}
        {isLooping && (
          <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: "#16a34a", color: "#fff" }}>
            LOOP
          </span>
        )}
      </button>
    </div>
  );
}
