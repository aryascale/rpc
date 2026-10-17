import Papa from "papaparse";

export interface Participant {
  id: string; // UUID registrasi (lowercase) — match QR /verify/<uuid>
  bib: string;
  name: string;
  category: string;
  gender: string;
  tshirtSize: string;
  paymentStatus: string; // 'settlement' = lunas
}

export interface CsvData {
  list: Participant[];
  byId: Map<string, Participant>;
  byBib: Map<string, Participant>;
}

export interface Lookup {
  id?: string;
  bib?: string;
}

const REQUIRED = ["id", "bib", "name", "category", "paymentStatus"] as const;
const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export function parseCsv(text: string): { data: CsvData | null; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { data: null, errors: [`Kolom wajib hilang: ${missing.join(", ")}`] };
  }

  const list: Participant[] = [];
  for (const row of parsed.data) {
    const p: Participant = {
      id: (row.id ?? "").trim().toLowerCase(),
      bib: (row.bib ?? "").trim(),
      name: (row.name ?? "").trim(),
      category: (row.category ?? "").trim(),
      gender: (row.gender ?? "").trim(),
      tshirtSize: (row.tshirtSize ?? "").trim(),
      paymentStatus: (row.paymentStatus ?? "").trim(),
    };
    if (p.id || p.bib) list.push(p);
  }

  return {
    data: {
      list,
      byId: new Map(list.map((p) => [p.id, p])),
      byBib: new Map(list.map((p) => [p.bib.toLowerCase(), p])),
    },
    errors: [],
  };
}

// QR e-ticket berisi URL /verify/<uuid>; scanner hardware biasanya mengirim BIB mentah.
export function extractLookup(raw: string): Lookup {
  const s = raw.trim();
  const m = s.match(UUID_RE);
  if (m) return { id: m[0].toLowerCase() };
  return { bib: s.toLowerCase() };
}
