import type { CsvData } from "./csv";

export interface CheckIn {
  at: string; // ISO timestamp
}

const K_CHECKINS = "rpc-scanner:checkins";
const K_OVERRIDES = "rpc-scanner:overrides";

function read<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  localStorage.setItem(key, JSON.stringify(v));
}

export const loadCheckins = (): Record<string, CheckIn> => read(K_CHECKINS, {});
export const loadOverrides = (): Record<string, true> => read(K_OVERRIDES, {});

export function addCheckin(id: string): void {
  const c = loadCheckins();
  c[id] = { at: new Date().toISOString() };
  write(K_CHECKINS, c);
}

export function setOverride(id: string): void {
  const o = loadOverrides();
  o[id] = true;
  write(K_OVERRIDES, o);
}

export function clearCheckins(): void {
  localStorage.removeItem(K_CHECKINS);
  localStorage.removeItem(K_OVERRIDES);
}

function q(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(data: CsvData, checkins: Record<string, CheckIn>): void {
  const rows = ["id,bib,name,category,paymentStatus,checkedInAt"];
  for (const [id, c] of Object.entries(checkins)) {
    const p = data.byId.get(id);
    rows.push([id, p?.bib ?? "", q(p?.name ?? ""), p?.category ?? "", p?.paymentStatus ?? "", c.at].join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `checkins-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
