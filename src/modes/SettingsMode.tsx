import { useState, useCallback, type ChangeEvent } from "react";
import {
  type AppSettings,
  type DisplayDesign,
  type DisplayOrientation,
  DESIGN_DEFAULTS,
  PRESET_THEMES,
  buildIdleSrcdoc,
} from "../lib/settings";
import { type CsvData, parseFile, getSampleData } from "../lib/csv";
import { loadCheckins, clearCheckins } from "../lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "data" | "api" | "design" | "launch";

interface Props {
  settings: AppSettings;
  data: CsvData | null;
  onSettingsChange: (s: AppSettings) => void;
  onDataChange: (d: CsvData | null) => void;
  onLaunch: () => void;
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "data", label: "Data", icon: "📁" },
  { id: "api", label: "API", icon: "🔌" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "launch", label: "Launch", icon: "🚀" },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsMode({
  settings,
  data,
  onSettingsChange,
  onDataChange,
  onLaunch,
}: Props) {
  const [tab, setTab] = useState<Tab>("data");
  const design = settings.design;

  function updateDesign(patch: Partial<DisplayDesign>) {
    onSettingsChange({ ...settings, design: { ...design, ...patch } });
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans selection:bg-red-500/20 selection:text-red-900">
      {/* ── Apple-style Crisp Light Sidebar ────────────────────────── */}
      <aside className="w-[84px] bg-white border-r border-slate-200/90 backdrop-blur-2xl flex flex-col items-center pt-6 pb-6 gap-2 shrink-0 shadow-sm z-20">
        <div className="flex flex-col items-center mb-6 select-none group cursor-pointer">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-red-600/25">
            L
          </div>
          <span className="text-[10px] font-black tracking-widest text-red-600 mt-2 uppercase">
            LUMPAT
          </span>
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              tab === t.id
                ? "bg-red-50 text-red-600 border border-red-200 shadow-sm"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/80"
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">
              {t.label}
            </span>
          </button>
        ))}
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {tab === "data" && (
          <DataTab data={data} onDataChange={onDataChange} />
        )}
        {tab === "api" && <ApiTab />}
        {tab === "design" && (
          <DesignTab design={design} onChange={updateDesign} />
        )}
        {tab === "launch" && (
          <LaunchTab data={data} settings={settings} onLaunch={onLaunch} onSettingsChange={onSettingsChange} />
        )}
      </main>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-1.5">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-all"
    />
  );
}

function Textarea({
  value,
  onChange,
  rows = 8,
  mono = false,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
  id?: string;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 outline-none rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 transition-all resize-y ${
        mono ? "font-mono text-xs leading-relaxed text-slate-900 bg-slate-100/60" : ""
      }`}
    />
  );
}

// ─── DATA TAB ─────────────────────────────────────────────────────────────────
function DataTab({
  data,
  onDataChange,
}: {
  data: CsvData | null;
  onDataChange: (d: CsvData | null) => void;
}) {
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const checkins = data ? loadCheckins() : {};
  const done = data
    ? Object.keys(checkins).filter((id) => data.byId.has(id)).length
    : 0;

  async function handleFile(file: File) {
    setError("");
    const { data: d, errors } = await parseFile(file);
    if (!d) {
      setError(errors.join(" "));
      return;
    }
    onDataChange(d);
  }

  async function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  }

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) await handleFile(file);
    },
    []
  );

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">
          Master Data
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload file peserta — CSV atau Excel (.xlsx, .xls)
        </p>
      </div>

      {/* Drop zone */}
      <label
        id="data-dropzone"
        className={`block cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-10 text-center mb-6 ${
          isDragging
            ? "border-red-500 bg-red-50/50"
            : "border-slate-300 bg-white hover:border-red-400 hover:bg-red-50/20 shadow-sm"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-4xl mb-3">📋</div>
        <p className="font-bold text-slate-800 text-sm">
          Drop file di sini, atau{" "}
          <span className="text-red-600 underline underline-offset-2">
            pilih file
          </span>
        </p>
        <p className="text-slate-500 text-xs mt-1.5">
          .csv · .xlsx · .xls — Kolom: epc / id, bib, name, category, paymentStatus, gender, tshirtSize
        </p>
        <input
          id="data-file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onFileInput}
          hidden
        />
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4 font-medium">
          {error}
        </div>
      )}

      {/* Quick Action: Load Sample Data */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onDataChange(getSampleData())}
          className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200/80 px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
        >
          <span>⚡</span>
          <span>Muat Master Data Contoh (@sample-data.csv)</span>
        </button>
        {data && (
          <button
            onClick={() => {
              if (confirm("Reset riwayat check-in untuk semua peserta?")) {
                clearCheckins();
                onDataChange({ ...data });
              }
            }}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
          >
            ↺ Reset Riwayat Check-in
          </button>
        )}
      </div>

      {/* Stats & Table */}
      {data ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
              Data Loaded
            </span>
            <span className="text-slate-500 text-xs ml-auto font-mono">{data.fileName}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Peserta", value: data.list.length, color: "text-slate-900" },
              {
                label: "Sudah Check-in",
                value: done,
                color: "text-emerald-600",
              },
              {
                label: "Belum Check-in",
                value: data.list.length - done,
                color: "text-red-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center"
              >
                <div className={`text-3xl font-black ${s.color}`}>
                  {s.value}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Participants Table */}
          <div className="mt-2 border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Daftar Peserta Terdaftar</span>
              <span>{data.list.length} Orang</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
              {data.list.map((p) => {
                const isPaid = p.paymentStatus === "settlement";
                const isCheckedIn = !!checkins[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg text-red-600 font-bold w-12">
                        #{p.bib}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Kategori: <strong className="text-slate-800">{p.category}</strong></span>
                          {p.epc && (
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                              EPC: {p.epc}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          isCheckedIn
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isCheckedIn ? "Sudah Diambil" : "Siap Ambil"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onDataChange(null)}
              className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors"
            >
              Hapus data & upload file lain
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Belum ada data diupload
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── API TAB ──────────────────────────────────────────────────────────────────
function ApiTab() {
  const [copied, setCopied] = useState(false);
  const endpoint = `${window.location.protocol}//${window.location.host}/api/scan`;

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const curlExample = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"code": "1017"}'`;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">
          API / RFID Integration
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Endpoint untuk software RFID / NFC reader hardware
        </p>
      </div>

      <Section title="Endpoint">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              POST
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-700 font-bold">
                Active & Ready
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <code className="text-sm text-red-600 font-mono font-bold flex-1 min-w-0 truncate">
              {endpoint}
            </code>
            <button
              id="copy-api-endpoint-btn"
              onClick={() => copy(endpoint)}
              className="shrink-0 text-slate-500 hover:text-slate-800 transition-colors font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
            >
              {copied ? "✓ Copied" : "Copy URL"}
            </button>
          </div>
        </Card>
      </Section>

      <Section
        title="Request Format"
        subtitle="Software RFID kirim POST request dengan body JSON atau plain-text"
      >
        <Card>
          <Label>JSON Body</Label>
          <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-slate-200">
            <span className="text-slate-500">{"{"}</span>
            <br />
            &nbsp;&nbsp;
            <span className="text-rose-400">"code"</span>
            <span className="text-slate-500">: </span>
            <span className="text-emerald-400">"1017"</span>
            <span className="text-slate-500"> // Nomor BIB atau RFID UUID</span>
            <br />
            <span className="text-slate-500">{"}"}</span>
          </div>
          <div className="mt-4">
            <Label>Response</Label>
            <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-400">
              {"{ \"ok\": true, \"code\": \"1017\" }"}
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Test via cURL">
        <Card>
          <div className="flex justify-between items-center mb-2">
            <Label>Command</Label>
            <button
              onClick={() => copy(curlExample)}
              className="text-xs text-red-600 hover:text-red-700 font-bold transition-colors"
            >
              Copy cURL
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
            {curlExample}
          </pre>
        </Card>
      </Section>

      <Section title="Catatan Penting">
        <Card>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="text-red-600 font-bold">•</span>
              <span>
                <strong>Display Mode</strong> harus aktif untuk menerima scan — SSE stream dihubungkan secara otomatis.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 font-bold">•</span>
              <span>
                <strong>Scanner USB / Bluetooth</strong> juga didukung via keyboard wedge langsung tanpa setup driver.
              </span>
            </li>
          </ul>
        </Card>
      </Section>
    </div>
  );
}

// ─── DESIGN TAB ───────────────────────────────────────────────────────────────
function DesignTab({
  design,
  onChange,
}: {
  design: DisplayDesign;
  onChange: (patch: Partial<DisplayDesign>) => void;
}) {
  function previewIdle() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildIdleSrcdoc(design));
    win.document.close();
  }

  function resetToDefault() {
    if (confirm("Reset semua design ke default Lumpat Red?")) onChange(DESIGN_DEFAULTS);
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">
            Custom Design
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Kustomisasi tema Lumpat, branding event, background, dan template
          </p>
        </div>
        <button
          onClick={resetToDefault}
          className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors"
        >
          Reset default Lumpat
        </button>
      </div>

      {/* ── Event Info ── */}
      {/* ── Orientasi Layar (Screen Orientation) ── */}
      <Section
        title="Orientasi Layar Display"
        subtitle="Pilih rasio tampilan yang sesuai dengan jenis layar: monitor horizontal atau totem berdiri"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: "auto",
              icon: "🔄",
              label: "Auto (Deteksi Layar)",
              desc: "Otomatis mengikuti orientasi fisik monitor/kiosk",
            },
            {
              id: "landscape",
              icon: "🖥️",
              label: "Landscape (16:9)",
              desc: "Format mendatar untuk monitor PC, laptop, atau smart TV",
            },
            {
              id: "portrait",
              icon: "📱",
              label: "Portrait (9:16)",
              desc: "Format tegak vertikal untuk Standing Totem, Kiosk, atau Digital Signage",
            },
          ].map((item) => {
            const isSelected = (design.orientation ?? "auto") === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`orientation-${item.id}`}
                onClick={() => onChange({ orientation: item.id as DisplayOrientation })}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-red-50/80 border-red-500 shadow-sm ring-2 ring-red-500/20"
                    : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{item.icon}</span>
                    {isSelected && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-sm text-slate-900">{item.label}</div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Event Info">
        <Card>
          <Label>Nama Event</Label>
          <Input
            id="input-event-name"
            value={design.eventName}
            onChange={(v) => onChange({ eventName: v })}
            placeholder="Lumpat Race Pack Collection 2025"
          />
        </Card>
      </Section>

      {/* ── Preset Themes ── */}
      <Section
        title="Preset Theme (Lumpat Red)"
        subtitle="Pilihan palet Lumpat cerah & modern"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {PRESET_THEMES.map((t) => (
            <div
              key={t.name}
              onClick={() => onChange(t.design)}
              className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-red-400 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md shadow-sm group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                    {t.badge}
                  </span>
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ background: t.design.bibColor }}
                  />
                </div>
                <div className="font-bold text-slate-900 text-sm group-hover:text-red-600 transition-colors">
                  {t.name}
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {t.description}
                </p>
              </div>
              <div className="mt-3 text-xs font-bold text-red-600 flex items-center gap-1">
                Terapkan Desain Ini →
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Result Card Colors ── */}
      <Section title="Result Display — Warna">
        <Card>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <Label>Warna Nomor BIB</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={design.bibColor}
                  onChange={(e) => onChange({ bibColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border-0 cursor-pointer bg-transparent"
                />
                <Input
                  value={design.bibColor}
                  onChange={(v) => onChange({ bibColor: v })}
                />
              </div>
            </div>
            <div>
              <Label>Warna Nama Peserta</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={design.nameColor}
                  onChange={(e) => onChange({ nameColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border-0 cursor-pointer bg-transparent"
                />
                <Input
                  value={design.nameColor}
                  onChange={(v) => onChange({ nameColor: v })}
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Label>Background Hasil Scan (CSS value)</Label>
            <Input
              value={design.resultBg}
              onChange={(v) => onChange({ resultBg: v })}
              placeholder="linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Mendukung: hex code (#ffffff), linear-gradient(), radial-gradient(), dll.
            </p>
          </div>
        </Card>
      </Section>

      {/* ── Result Custom CSS ── */}
      <Section
        title="Result Card — Custom CSS"
        subtitle="Selector yang tersedia: .result-bib, .result-name, .result-status, .result-chip"
      >
        <Card>
          <Textarea
            id="result-custom-css"
            value={design.resultCustomCss}
            onChange={(v) => onChange({ resultCustomCss: v })}
            rows={5}
            mono
          />
        </Card>
      </Section>

      {/* ── Idle Screen ── */}
      <Section
        title="Idle Screen — HTML"
        subtitle="HTML yang ditampilkan saat menunggu scan (dirender dalam mode fullscreen)"
      >
        <Card>
          <Textarea
            id="idle-html-editor"
            value={design.idleHtml}
            onChange={(v) => onChange({ idleHtml: v })}
            rows={8}
            mono
          />
        </Card>
      </Section>

      <Section
        title="Idle Screen — CSS"
        subtitle="CSS kustom untuk idle screen"
      >
        <Card>
          <Textarea
            id="idle-css-editor"
            value={design.idleCss}
            onChange={(v) => onChange({ idleCss: v })}
            rows={10}
            mono
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              id="preview-idle-btn"
              onClick={previewIdle}
              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
            >
              🔍 Buka Preview Layar Penuh di Tab Baru →
            </button>
            <span className="text-[11px] font-semibold text-slate-400">
              Orientasi Aktif: <strong className="text-slate-700 uppercase">{design.orientation ?? "auto"}</strong>
            </span>
          </div>
        </Card>
      </Section>

      {/* ── Behavior ── */}
      <Section title="Behavior & Hold Duration">
        <Card>
          <div className="mb-5">
            <Label>Durasi Tampil Hasil Scan (Detik)</Label>
            <div className="flex items-center gap-4">
              <input
                id="hold-seconds-slider"
                type="range"
                min={5}
                max={60}
                value={design.holdSeconds}
                onChange={(e) =>
                  onChange({ holdSeconds: Number(e.target.value) })
                }
                className="flex-1 accent-red-600"
              />
              <span className="text-2xl font-black text-red-600 w-14 text-right">
                {design.holdSeconds}s
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <Label>Komponen yang Ditampilkan di Layar Hasil Scan</Label>
            <p className="text-xs text-slate-500 mb-3">
              Pilih informasi peserta yang ingin ditampilkan saat scan berhasil
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: "showBib", label: "Nomor BIB", icon: "🔢", value: design.showBib },
                { id: "showName", label: "Nama Peserta", icon: "👤", value: design.showName },
                { id: "showCategory", label: "Kategori Lomba", icon: "🏃", value: design.showCategory },
                { id: "showTshirtSize", label: "Ukuran Kaos / Baju", icon: "👕", value: design.showTshirtSize },
                { id: "showGender", label: "Gender", icon: "⚧️", value: design.showGender },
                { id: "showStatus", label: "Status Check-in", icon: "✅", value: design.showStatus },
                { id: "showEventName", label: "Nama Event (Header)", icon: "🏷️", value: design.showEventName },
                { id: "showEpc", label: "Kode RFID / EPC", icon: "📡", value: design.showEpc },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    item.value
                      ? "bg-red-50/50 border-red-300 text-slate-900 shadow-xs"
                      : "bg-slate-50/60 border-slate-200 text-slate-400 hover:bg-slate-100/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) => onChange({ [item.id]: e.target.checked })}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="text-xs font-bold leading-tight">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── LAUNCH TAB ───────────────────────────────────────────────────────────────
function LaunchTab({
  data,
  settings,
  onLaunch,
  onSettingsChange,
}: {
  data: CsvData | null;
  settings: AppSettings;
  onLaunch: () => void;
  onSettingsChange: (s: AppSettings) => void;
}) {
  const checks = [
    {
      label: "Master data loaded",
      ok: !!data,
      detail: data ? `${data.list.length} peserta dari ${data.fileName}` : "Belum upload file peserta",
    },
    {
      label: "Event name set",
      ok: !!settings.design.eventName.trim(),
      detail: settings.design.eventName || "Belum diisi",
    },
    {
      label: "Display design ready",
      ok: true,
      detail: `Lumpat Red · Hold: ${settings.design.holdSeconds}s`,
    },
    {
      label: "Mode Tampilan Kiosk",
      ok: true,
      detail: settings.devMode
        ? "🛠️ Developer Mode (Simulator & Switcher Aktif)"
        : "✨ Clean Production (100% Layar Bersih Fullscreen)",
    },
    {
      label: "Orientasi Display",
      ok: true,
      detail: settings.design.orientation === "portrait"
        ? `📱 Portrait 9:16 (${settings.design.kioskFitMode === "stretch" ? "Stretch Full" : "Totem Stage"})`
        : settings.design.orientation === "landscape"
        ? "🖥️ Landscape (16:9 Monitor / TV Horizontal)"
        : "🔄 Auto (Deteksi Otomatis Sesuai Layar Monitor)",
    },
  ];

  const canLaunch = !!data;

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">
          Launch Display
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Cek status dan mode sebelum mengaktifkan display monitor fullscreen
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-3 mb-6">
        {checks.map((c) => (
          <div
            key={c.label}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              c.ok
                ? "bg-emerald-50/60 border-emerald-200"
                : "bg-red-50/60 border-red-200"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${
                c.ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
              }`}
            >
              {c.ok ? "✓" : "✗"}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{c.label}</div>
              <div className={`text-xs mt-0.5 ${c.ok ? "text-slate-500" : "text-red-600 font-semibold"}`}>
                {c.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Developer Mode Toggle Card ────────────────────────────── */}
      <div className="mb-6 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm transition-all hover:border-slate-300">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-xs ${
              settings.devMode ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
            }`}>
              {settings.devMode ? "🛠️" : "✨"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">Mode Developer</span>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  settings.devMode
                    ? "bg-amber-100 text-amber-800 border border-amber-300/80"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300/80"
                }`}>
                  {settings.devMode ? "Aktif (Testing)" : "Nonaktif (Clean Display)"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {settings.devMode
                  ? "Simulator scan, tombol rotasi & totem muncul di layar display untuk kemudahan testing."
                  : "Layar display 100% bersih tanpa tombol simulator, rotasi, atau totem. Siap untuk event publik!"}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            id="toggle-dev-mode"
            type="button"
            onClick={() => onSettingsChange({ ...settings, devMode: !settings.devMode })}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.devMode ? "bg-red-600" : "bg-slate-300"
            }`}
            title="Klik untuk mengaktifkan / menonaktifkan Mode Developer"
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                settings.devMode ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ── Preset Orientasi & Totem Kiosk ────────────────────────── */}
      <div className="mb-6 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col gap-4">
        {/* Orientasi */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {settings.design.orientation === "portrait"
                ? "📱"
                : settings.design.orientation === "landscape"
                ? "🖥️"
                : "🔄"}
            </span>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Orientasi Layar (Awal)
              </div>
              <div className="text-sm font-black text-slate-800">
                {settings.design.orientation === "portrait"
                  ? "Portrait (9:16 Kiosk / Totem)"
                  : settings.design.orientation === "landscape"
                  ? "Landscape (16:9 TV / Monitor)"
                  : "Auto (Deteksi Layar)"}
              </div>
            </div>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {(["auto", "landscape", "portrait"] as const).map((m) => {
              const active = (settings.design.orientation ?? "auto") === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      design: { ...settings.design, orientation: m },
                    })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    active
                      ? "bg-white text-red-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {m === "auto" ? "Auto" : m === "landscape" ? "Land" : "Port"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Format Totem Kiosk (jika portrait aktif atau auto) */}
        {settings.design.orientation !== "landscape" && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Format Layar Portrait di Monitor Landscape
              </div>
              <div className="text-xs text-slate-600 font-medium mt-0.5">
                {settings.design.kioskFitMode === "stretch"
                  ? "Layar Penuh (Stretch Fullscreen)"
                  : "Totem 9:16 (Centered Stage + Spotlight)"}
              </div>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {(["totem", "stretch"] as const).map((mode) => {
                const active = (settings.design.kioskFitMode ?? "totem") === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      onSettingsChange({
                        ...settings,
                        design: { ...settings.design, kioskFitMode: mode },
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                      active
                        ? "bg-white text-red-600 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {mode === "totem" ? "📱 Totem 9:16" : "↔️ Stretch"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Launch button */}
      <button
        id="launch-display-btn"
        onClick={onLaunch}
        disabled={!canLaunch}
        className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg transition-all duration-300 ${
          canLaunch
            ? "bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white shadow-xl shadow-red-600/30 cursor-pointer"
            : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
        }`}
      >
        {canLaunch ? "🚀 Launch Fullscreen Display" : "Upload Data Peserta Dahulu"}
      </button>

      {canLaunch && (
        <p className="text-center text-xs text-slate-500 mt-3 font-medium">
          Tekan <kbd className="bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-mono">Esc</kbd> saat
          fullscreen untuk kembali ke menu settings
        </p>
      )}
    </div>
  );
}
