// ─── Display Orientation ───────────────────────────────────────────────────────
export type DisplayOrientation = "auto" | "landscape" | "portrait";
export type KioskFitMode = "totem" | "stretch";

// ─── Display Design ────────────────────────────────────────────────────────────
export interface DisplayDesign {
  // Screen Orientation ('auto', 'landscape', or 'portrait')
  orientation: DisplayOrientation;
  kioskFitMode?: KioskFitMode; // Format tampilan portrait di layar landscape

  // Idle screen (rendered as full HTML document in iframe)
  idleHtml: string;
  idleCss: string;

  // Result card colors
  bibColor: string;         // BIB number color (CSS color string)
  nameColor: string;        // Participant name color
  resultBg: string;         // CSS background value for overlay
  resultCustomCss: string;  // Extra CSS injected into result display

  // Event branding
  eventName: string;

  // Behavior & Component Visibility Checklist
  holdSeconds: number;      // How long result is shown (default 30)
  showBib: boolean;         // Nomor BIB
  showName: boolean;        // Nama Peserta
  showCategory: boolean;    // Kategori Lomba (5K, 10K, dll.)
  showGender: boolean;      // Gender
  showTshirtSize: boolean;  // Ukuran Baju / Kaos
  showStatus: boolean;      // Status Check-in / Lunas
  showEventName: boolean;   // Header Nama Event
  showEpc: boolean;         // Kode EPC RFID
}

// ─── Preset 1: Default Lumpat Marathon Expo ──────────────────────────────────
export const IDLE_HTML_MARATHON = `
<div class="expo-scene">
  <!-- Dynamic athletic track curves in background -->
  <svg class="track-bg" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M-100 800 C300 820 600 650 900 450 C1200 250 1400 200 1600 200" stroke="#f1f5f9" stroke-width="80" stroke-linecap="round" />
    <path d="M-100 860 C300 880 600 710 900 510 C1200 310 1400 260 1600 260" stroke="#fee2e2" stroke-width="40" stroke-linecap="round" stroke-dasharray="16 20" />
    <path d="M-100 920 C300 940 600 770 900 570 C1200 370 1400 320 1600 320" stroke="#fecaca" stroke-width="8" stroke-linecap="round" />
  </svg>

  <div class="ambient-glow"></div>

  <!-- Header Pill -->
  <div class="top-badge">
    <span class="live-dot"></span>
    <span class="badge-title">OFFICIAL RFID TIMING • LUMPAT ECOSYSTEM</span>
    <span class="badge-sep">•</span>
    <span class="badge-sub">GATE 01</span>
  </div>

  <!-- Brand & Event Identity -->
  <div class="hero-brand">
    <div class="lumpat-logo">LUMPAT</div>
    <div class="event-title">MARATHON RACE PACK EXPO</div>
    <div class="event-details">
      <span>JAKARTA INTERNATIONAL EXPO</span>
      <span class="dot-divider">/</span>
      <span>42K • 21K • 10K • 5K</span>
    </div>
  </div>

  <!-- Floating Scanner Pod (Apple-Style) -->
  <div class="scanner-pod">
    <div class="radar-circle">
      <div class="radar-pulse"></div>
      <div class="radar-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <circle cx="12" cy="20" r="1.5"></circle>
        </svg>
      </div>
    </div>
    <div class="scanner-text-group">
      <div class="scanner-headline">TEMPELKAN GELANG ATAU BIB RFID ANDA</div>
      <div class="scanner-caption">Dekatkan chip RFID ke sensor untuk verifikasi data dan pengambilan race pack</div>
    </div>
  </div>

  <!-- Footer Info -->
  <div class="expo-footer">
    <span>LUMPAT HIGH-PRECISION RACE TIMING SYSTEM</span>
    <span class="footer-sep">•</span>
    <span>GEN2 UHF / NFC ENABLED</span>
  </div>
</div>
`;

export const IDLE_CSS_MARATHON = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%;
  background: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  color: #0f172a;
}
.expo-scene {
  position: relative;
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: space-between;
  padding: 4vw 3vw 3vw;
  z-index: 10;
}
.track-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  pointer-events: none;
  z-index: 0;
  opacity: 0.7;
}
.ambient-glow {
  position: absolute;
  top: 40%; left: 50%;
  transform: translate(-50%, -50%);
  width: 65vw; height: 50vw;
  background: radial-gradient(circle, rgba(220, 38, 38, 0.08) 0%, rgba(239, 68, 68, 0.02) 50%, transparent 75%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 1;
}
.top-badge {
  position: relative;
  z-index: 10;
  display: inline-flex; align-items: center; gap: 9px;
  padding: 8px 22px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(220, 38, 38, 0.15);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(16px);
}
.live-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #dc2626;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.8);
  animation: pulse-dot 1.8s infinite ease-in-out;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}
.badge-title {
  font-size: 0.75vw;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: #dc2626;
  text-transform: uppercase;
}
.badge-sep { color: #cbd5e1; }
.badge-sub {
  font-size: 0.75vw;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #64748b;
}
.hero-brand {
  position: relative;
  z-index: 10;
  text-align: center;
  display: flex; flex-direction: column; align-items: center;
  margin-top: 1vw;
}
.lumpat-logo {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 17vw;
  line-height: 0.86;
  letter-spacing: 0.03em;
  color: #dc2626;
  filter: drop-shadow(0 15px 35px rgba(220, 38, 38, 0.15));
}
.event-title {
  font-size: 1.6vw;
  font-weight: 800;
  color: #1e293b;
  letter-spacing: 0.45em;
  margin-top: 1vw;
  text-transform: uppercase;
}
.event-details {
  display: flex; align-items: center; gap: 12px;
  font-size: 0.9vw;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: #64748b;
  margin-top: 0.7vw;
  text-transform: uppercase;
}
.dot-divider { color: #dc2626; font-weight: bold; }
.scanner-pod {
  position: relative;
  z-index: 10;
  display: inline-flex; align-items: center; gap: 24px;
  padding: 18px 40px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 9999px;
  box-shadow: 0 16px 45px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(220, 38, 38, 0.05);
  backdrop-filter: blur(24px);
  animation: float-pod 4s ease-in-out infinite;
  margin-bottom: 1vw;
}
@keyframes float-pod {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}
.radar-circle {
  position: relative;
  width: 56px; height: 56px;
  border-radius: 50%;
  background: #fef2f2;
  border: 1.5px solid #fecaca;
  display: flex; align-items: center; justify-content: center;
  color: #dc2626;
}
.radar-pulse {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid #ef4444;
  opacity: 0.5;
  animation: pulse-radar 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes pulse-radar {
  0% { transform: scale(0.9); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}
.scanner-text-group { text-align: left; }
.scanner-headline {
  font-size: 1.15vw;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.scanner-caption {
  font-size: 0.85vw;
  font-weight: 500;
  color: #64748b;
  margin-top: 3px;
}
.expo-footer {
  position: relative;
  z-index: 10;
  display: flex; align-items: center; gap: 12px;
  font-size: 0.7vw;
  font-weight: 700;
  letter-spacing: 0.25em;
  color: #94a3b8;
  text-transform: uppercase;
}
.footer-sep { color: #cbd5e1; }

/* ─── Portrait Mode (Standing Totem / Kiosk / 9:16) ─────────── */
@media (orientation: portrait), (max-aspect-ratio: 1/1) {
  .expo-scene { padding: 7vh 6vw 5vh; justify-content: space-between; }
  .track-bg { opacity: 0.55; transform: rotate(90deg) scale(1.6); }
  .ambient-glow { width: 90vw; height: 70vw; top: 35%; }
  .top-badge { padding: 10px 22px; }
  .badge-title { font-size: clamp(10px, 2.2vw, 14px); }
  .badge-sub { font-size: clamp(10px, 2.2vw, 14px); }
  .hero-brand { margin-top: 2vh; }
  .lumpat-logo { font-size: clamp(80px, 28vw, 180px); line-height: 0.85; }
  .event-title { font-size: clamp(14px, 3.8vw, 24px); letter-spacing: 0.28em; margin-top: 1.5vh; }
  .event-details { font-size: clamp(11px, 2.6vw, 16px); flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 1.5vh; }
  .scanner-pod {
    flex-direction: column; text-align: center;
    padding: 30px 24px; width: 88vw; max-width: 440px; border-radius: 36px; gap: 16px; margin-bottom: 2vh;
  }
  .scanner-text-group { text-align: center; }
  .scanner-headline { font-size: clamp(14px, 3.8vw, 22px); line-height: 1.3; }
  .scanner-caption { font-size: clamp(11px, 2.8vw, 15px); margin-top: 6px; }
  .expo-footer { font-size: clamp(9px, 2.2vw, 13px); flex-wrap: wrap; justify-content: center; text-align: center; }
}

.orientation-portrait .expo-scene { padding: 7vh 6vw 5vh; justify-content: space-between; }
.orientation-portrait .track-bg { opacity: 0.55; transform: rotate(90deg) scale(1.6); }
.orientation-portrait .ambient-glow { width: 90vw; height: 70vw; top: 35%; }
.orientation-portrait .top-badge { padding: 10px 22px; }
.orientation-portrait .badge-title { font-size: clamp(10px, 2.2vw, 14px); }
.orientation-portrait .badge-sub { font-size: clamp(10px, 2.2vw, 14px); }
.orientation-portrait .hero-brand { margin-top: 2vh; }
.orientation-portrait .lumpat-logo { font-size: clamp(80px, 28vw, 180px); line-height: 0.85; }
.orientation-portrait .event-title { font-size: clamp(14px, 3.8vw, 24px); letter-spacing: 0.28em; margin-top: 1.5vh; }
.orientation-portrait .event-details { font-size: clamp(11px, 2.6vw, 16px); flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 1.5vh; }
.orientation-portrait .scanner-pod {
  flex-direction: column; text-align: center;
  padding: 30px 24px; width: 88vw; max-width: 440px; border-radius: 36px; gap: 16px; margin-bottom: 2vh;
}
.orientation-portrait .scanner-text-group { text-align: center; }
.orientation-portrait .scanner-headline { font-size: clamp(14px, 3.8vw, 22px); line-height: 1.3; }
.orientation-portrait .scanner-caption { font-size: clamp(11px, 2.8vw, 15px); margin-top: 6px; }
.orientation-portrait .expo-footer { font-size: clamp(9px, 2.2vw, 13px); flex-wrap: wrap; justify-content: center; text-align: center; }
`;

export const RESULT_CUSTOM_CSS_MARATHON = `
/* ─── Apple-grade Official Race BIB Styling ───────────── */
.result-bib-card {
  position: relative;
  background: #ffffff !important;
  border: 2px solid #e2e8f0 !important;
  border-radius: 36px !important;
  padding: 3.5vw 4vw !important;
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.03) !important;
  overflow: hidden;
}

/* Corner Hole Punches (Like authentic physical race bib) */
.result-bib-card::before, .result-bib-card::after {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 2px solid #cbd5e1;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);
}
.result-bib-card::before { top: 20px; left: 24px; }
.result-bib-card::after { top: 20px; right: 24px; }

/* Runner Name */
.result-name {
  font-weight: 900 !important;
  letter-spacing: -0.02em !important;
  color: #0f172a !important;
}

/* Official BIB Number */
.result-bib {
  font-family: 'Bebas Neue', sans-serif !important;
  letter-spacing: 0.05em !important;
  color: #dc2626 !important;
  filter: drop-shadow(0 15px 30px rgba(220, 38, 38, 0.2)) !important;
}

/* Metadata Chips */
.result-chip {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 20px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important;
}

/* Portrait Adaptations for Result Card */
@media (orientation: portrait), (max-aspect-ratio: 1/1) {
  .result-bib-card {
    width: 90vw !important;
    max-width: 520px !important;
    padding: 44px 28px !important;
    border-radius: 40px !important;
  }
  .result-name {
    font-size: clamp(28px, 7vw, 44px) !important;
  }
  .result-bib {
    font-size: clamp(84px, 26vw, 150px) !important;
  }
  .result-chip {
    padding: 12px 20px !important;
  }
}

.orientation-portrait .result-bib-card {
  width: 90vw !important;
  max-width: 520px !important;
  padding: 44px 28px !important;
  border-radius: 40px !important;
}
.orientation-portrait .result-name {
  font-size: clamp(28px, 7vw, 44px) !important;
}
.orientation-portrait .result-bib {
  font-size: clamp(84px, 26vw, 150px) !important;
}
.orientation-portrait .result-chip {
  padding: 12px 20px !important;
}
`;

// ─── Preset 2: 10K City Run ───────────────────────────────────────────────────
export const IDLE_HTML_CITY = `
<div class="city-scene">
  <div class="glow-bg"></div>
  <div class="header-tag">
    <span class="red-bar"></span>
    <span class="header-text">LUMPAT 10K CITY RUN • RACE COLLECTION</span>
  </div>
  <div class="center-content">
    <div class="city-mark">LUMPAT</div>
    <div class="city-sub">URBAN CHALLENGE SERIES</div>
    <div class="card-action">
      <div class="scan-chip">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="3"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
        </svg>
      </div>
      <div class="action-text">
        <div class="main-act">TEMPELKAN BIB ATAU GELANG PESERTA</div>
        <div class="sub-act">Sistem otomatis mendeteksi nomor BIB & status registrasi</div>
      </div>
    </div>
  </div>
  <div class="city-footer">
    <span>TIMING VERIFIED BY LUMPAT RFID HARDWARE</span>
  </div>
</div>
`;

export const IDLE_CSS_CITY = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%;
  background: #f8fafc;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #0f172a;
}
.city-scene {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  padding: 4vw 3vw 3vw;
  position: relative;
}
.glow-bg {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 70vw; height: 50vw;
  background: radial-gradient(circle, rgba(239,68,68,0.09) 0%, transparent 65%);
  filter: blur(80px);
}
.header-tag {
  display: inline-flex; align-items: center; gap: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  padding: 8px 24px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
}
.red-bar {
  width: 10px; height: 10px; border-radius: 2px;
  background: #ef4444;
}
.header-text {
  font-size: 0.8vw; font-weight: 800; letter-spacing: 0.2em; color: #0f172a; text-transform: uppercase;
}
.center-content { text-align: center; }
.city-mark {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18vw;
  line-height: 0.85;
  color: #ef4444;
  letter-spacing: 0.04em;
  filter: drop-shadow(0 15px 30px rgba(239,68,68,0.2));
}
.city-sub {
  font-size: 1.5vw; font-weight: 800; letter-spacing: 0.35em; color: #475569; text-transform: uppercase; margin-top: 1vw;
}
.card-action {
  margin-top: 3.5vw;
  display: inline-flex; align-items: center; gap: 20px;
  padding: 16px 36px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  box-shadow: 0 12px 35px -8px rgba(0,0,0,0.06);
}
.scan-chip {
  width: 52px; height: 52px; border-radius: 50%;
  background: #fee2e2; color: #ef4444;
  display: flex; align-items: center; justify-content: center;
}
.action-text { text-align: left; }
.main-act { font-size: 1.1vw; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; }
.sub-act { font-size: 0.8vw; color: #64748b; margin-top: 2px; }
.city-footer { font-size: 0.75vw; font-weight: 700; letter-spacing: 0.2em; color: #94a3b8; text-transform: uppercase; }

/* ─── Portrait Mode (Standing Totem / Kiosk / 9:16) ─────────── */
@media (orientation: portrait), (max-aspect-ratio: 1/1) {
  .city-scene { padding: 7vh 6vw 5vh; justify-content: space-between; }
  .header-text { font-size: clamp(10px, 2.4vw, 14px); }
  .city-mark { font-size: clamp(80px, 30vw, 180px); line-height: 0.85; }
  .city-sub { font-size: clamp(13px, 3.5vw, 22px); letter-spacing: 0.22em; margin-top: 1.5vh; }
  .card-action {
    flex-direction: column; text-align: center;
    padding: 30px 24px; width: 88vw; max-width: 440px; border-radius: 36px; gap: 16px; margin-top: 3vh;
  }
  .action-text { text-align: center; }
  .main-act { font-size: clamp(14px, 3.8vw, 22px); }
  .sub-act { font-size: clamp(11px, 2.8vw, 15px); }
  .city-footer { font-size: clamp(9px, 2.2vw, 13px); text-align: center; }
}

.orientation-portrait .city-scene { padding: 7vh 6vw 5vh; justify-content: space-between; }
.orientation-portrait .header-text { font-size: clamp(10px, 2.4vw, 14px); }
.orientation-portrait .city-mark { font-size: clamp(80px, 30vw, 180px); line-height: 0.85; }
.orientation-portrait .city-sub { font-size: clamp(13px, 3.5vw, 22px); letter-spacing: 0.22em; margin-top: 1.5vh; }
.orientation-portrait .card-action {
  flex-direction: column; text-align: center;
  padding: 30px 24px; width: 88vw; max-width: 440px; border-radius: 36px; gap: 16px; margin-top: 3vh;
}
.orientation-portrait .action-text { text-align: center; }
.orientation-portrait .main-act { font-size: clamp(14px, 3.8vw, 22px); }
.orientation-portrait .sub-act { font-size: clamp(11px, 2.8vw, 15px); }
.orientation-portrait .city-footer { font-size: clamp(9px, 2.2vw, 13px); text-align: center; }
`;

// ─── Defaults ─────────────────────────────────────────────────────────────────
export const DESIGN_DEFAULTS: DisplayDesign = {
  orientation: 'auto',
  kioskFitMode: 'totem',
  idleHtml: IDLE_HTML_MARATHON,
  idleCss: IDLE_CSS_MARATHON,
  bibColor: '#dc2626',
  nameColor: '#0f172a',
  resultBg: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  resultCustomCss: RESULT_CUSTOM_CSS_MARATHON,
  eventName: 'Lumpat Marathon Race Pack Expo',
  holdSeconds: 30,
  showBib: true,
  showName: true,
  showCategory: true,
  showGender: true,
  showTshirtSize: true,
  showStatus: true,
  showEventName: true,
  showEpc: true,
};

// ─── Scan Mode ────────────────────────────────────────────────────────────────
/** How the display listens for scan input. */
export type ScanMode = "rfid" | "qr" | "both";

// ─── App Settings ──────────────────────────────────────────────────────────────
export interface AppSettings {
  design: DisplayDesign;
  devMode: boolean; // Jika aktif: memunculkan simulator RPC & tools debug di display mode. Jika nonaktif: layar 100% bersih.
  scanMode: ScanMode; // 'rfid' = RFID/USB only | 'qr' = camera QR only | 'both' = keduanya
}

const STORAGE_KEY = 'rpc:settings-v5';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { devMode: false, scanMode: "rfid" as ScanMode, design: { ...DESIGN_DEFAULTS } };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    
    // Auto-migrate stale cached CSS that predates portrait orientation support
    let idleCss = parsed.design?.idleCss ?? DESIGN_DEFAULTS.idleCss;
    if (idleCss && !idleCss.includes(".orientation-portrait")) {
      idleCss = DESIGN_DEFAULTS.idleCss;
    }
    let resultCustomCss = parsed.design?.resultCustomCss ?? DESIGN_DEFAULTS.resultCustomCss;
    if (resultCustomCss && !resultCustomCss.includes(".orientation-portrait")) {
      resultCustomCss = DESIGN_DEFAULTS.resultCustomCss;
    }

    const d: Partial<DisplayDesign> = parsed.design ?? {};

    return {
      devMode: parsed.devMode !== undefined ? parsed.devMode : false,
      scanMode: (parsed.scanMode as ScanMode | undefined) ?? "rfid",
      design: {
        ...DESIGN_DEFAULTS,
        ...d,
        idleCss,
        resultCustomCss,
        orientation: d.orientation ?? 'auto',
        kioskFitMode: d.kioskFitMode ?? 'totem',
        showBib: d.showBib !== undefined ? d.showBib : true,
        showName: d.showName !== undefined ? d.showName : true,
        showCategory: d.showCategory !== undefined ? d.showCategory : true,
        showGender: d.showGender !== undefined ? d.showGender : true,
        showTshirtSize: d.showTshirtSize !== undefined ? d.showTshirtSize : true,
        showStatus: d.showStatus !== undefined ? d.showStatus : true,
        showEventName: d.showEventName !== undefined ? d.showEventName : true,
        showEpc: d.showEpc !== undefined ? d.showEpc : true,
      },
    };
  } catch {
    return { devMode: false, scanMode: "rfid" as ScanMode, design: { ...DESIGN_DEFAULTS } };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Helper: build full HTML document for idle iframe ──────────────────────────
export function buildIdleSrcdoc(
  design: DisplayDesign,
  forcedOrientation?: 'portrait' | 'landscape'
): string {
  const mode = forcedOrientation ?? (design.orientation === 'auto' ? 'auto' : design.orientation);
  const rootClass = `orientation-${mode}`;
  return `<!DOCTYPE html>
<html class="${rootClass}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;700;900&display=swap" rel="stylesheet">
<style>
${design.idleCss}

/* Universal portrait guarantees when orientation is forced */
${mode === 'portrait' ? `
html, body {
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
}
.expo-scene, .city-scene {
  padding: 5vh 5vw 4vh !important;
  justify-content: space-between !important;
}
.track-bg {
  opacity: 0.55 !important;
  transform: rotate(90deg) scale(1.6) !important;
}
.ambient-glow {
  width: 90vw !important;
  height: 70vw !important;
  top: 35% !important;
}
.top-badge, .header-tag {
  padding: 10px 22px !important;
}
.badge-title, .badge-sub, .header-text {
  font-size: clamp(10px, 2.8vmin, 13px) !important;
}
.hero-brand {
  margin-top: 1.5vh !important;
  text-align: center !important;
}
.lumpat-logo, .city-mark {
  font-size: clamp(60px, 22vmin, 150px) !important;
  line-height: 0.85 !important;
  letter-spacing: 0.02em !important;
}
.event-title, .city-sub {
  font-size: clamp(12px, 3.6vmin, 18px) !important;
  letter-spacing: 0.22em !important;
  margin-top: 1.2vh !important;
}
.event-details {
  font-size: clamp(10px, 2.6vmin, 13px) !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  gap: 8px !important;
  margin-top: 1vh !important;
}
.scanner-pod, .card-action {
  flex-direction: column !important;
  text-align: center !important;
  padding: 24px 20px !important;
  width: 88% !important;
  max-width: 400px !important;
  border-radius: 32px !important;
  gap: 14px !important;
  margin-bottom: 2vh !important;
}
.scanner-text-group, .action-text {
  text-align: center !important;
}
.scanner-headline, .main-act {
  font-size: clamp(13px, 3.5vmin, 19px) !important;
  line-height: 1.3 !important;
}
.scanner-caption, .sub-act {
  font-size: clamp(10px, 2.5vmin, 13px) !important;
  margin-top: 4px !important;
}
.expo-footer, .city-footer {
  font-size: clamp(9px, 2vmin, 12px) !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  text-align: center !important;
}
` : ''}
</style>
</head>
<body class="${rootClass}">${design.idleHtml}</body>
</html>`;
}

// ─── Preset Themes ─────────────────────────────────────────────────────────────
export interface Theme {
  name: string;
  badge: string;
  description: string;
  design: Partial<DisplayDesign>;
}

export const PRESET_THEMES: Theme[] = [
  {
    name: "Lumpat Marathon Expo (Full Event)",
    badge: "Official Expo",
    description: "Athletic track lines, official RFID scanner pod, authentic physical race bib styling.",
    design: {
      eventName: "Lumpat Marathon Race Pack Expo",
      bibColor: "#dc2626",
      nameColor: "#0f172a",
      resultBg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
      idleHtml: IDLE_HTML_MARATHON,
      idleCss: IDLE_CSS_MARATHON,
      resultCustomCss: RESULT_CUSTOM_CSS_MARATHON,
    },
  },
  {
    name: "Lumpat 10K City Run (Speed Edition)",
    badge: "Urban 10K",
    description: "Dynamic red speed accent, modern urban layout, high contrast BIB card.",
    design: {
      eventName: "Lumpat 10K City Run Jakarta",
      bibColor: "#ef4444",
      nameColor: "#0f172a",
      resultBg: "linear-gradient(180deg, #ffffff 0%, #fff5f5 100%)",
      idleHtml: IDLE_HTML_CITY,
      idleCss: IDLE_CSS_CITY,
      resultCustomCss: RESULT_CUSTOM_CSS_MARATHON,
    },
  },
  {
    name: "Apple Studio Minimalist",
    badge: "Minimalist",
    description: "Clean pure white gallery aesthetic, ultra-sharp typography, crimson red accents.",
    design: {
      eventName: "Official Race Pack Collection",
      bibColor: "#b91c1c",
      nameColor: "#000000",
      resultBg: "#ffffff",
      resultCustomCss: RESULT_CUSTOM_CSS_MARATHON,
    },
  },
];
