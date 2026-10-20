import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface Participant {
  id: string; // UUID registrasi atau identifier unik (lowercase)
  epc?: string; // EPC RFID UHF (uppercase hex)
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
  byEpc: Map<string, Participant>;
  fileName: string;
}

/**
 * Tracks which Participant fields are actually populated in the loaded dataset.
 * Used to dynamically enable/disable component visibility toggles in the UI.
 */
export interface AvailableFields {
  bib: boolean;
  name: boolean;
  category: boolean;
  gender: boolean;
  tshirtSize: boolean;
  paymentStatus: boolean;
  epc: boolean;
  /** eventName is always available — it's set manually by the user, not from CSV */
  eventName: boolean;
}

/**
 * Inspect the loaded CsvData and return which fields have at least one
 * non-empty value across all participants.
 */
export function getAvailableFields(data: CsvData | null): AvailableFields {
  if (!data || data.list.length === 0) {
    // No data loaded — treat all as available so nothing gets blocked
    return {
      bib: true, name: true, category: true, gender: true,
      tshirtSize: true, paymentStatus: true, epc: true, eventName: true,
    };
  }

  const result: AvailableFields = {
    bib: false, name: false, category: false, gender: false,
    tshirtSize: false, paymentStatus: false, epc: false, eventName: true,
  };

  for (const p of data.list) {
    if (p.bib) result.bib = true;
    if (p.name) result.name = true;
    if (p.category) result.category = true;
    if (p.gender) result.gender = true;
    if (p.tshirtSize) result.tshirtSize = true;
    if (p.paymentStatus) result.paymentStatus = true;
    if (p.epc) result.epc = true;

    // Early exit if everything found
    const { eventName: _e, ...checks } = result;
    if (Object.values(checks).every(Boolean)) break;
  }

  return result;
}

export interface Lookup {
  id?: string;
  bib?: string;
  epc?: string;
  cleanedCode: string;
}

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const EPC_HEX_RE = /^[0-9a-fA-F]{16,32}$/;

function getRowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
    // Case-insensitive fallback
    const found = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase());
    if (found && row[found] !== undefined && row[found] !== null) return String(row[found]).trim();
  }
  return "";
}

function buildData(rows: Record<string, string>[], fileName: string): { data: CsvData | null; errors: string[] } {
  if (rows.length === 0) {
    return { data: null, errors: ["File kosong atau tidak memiliki baris data."] };
  }

  const sampleRow = rows[0];
  const keysLower = Object.keys(sampleRow).map((k) => k.toLowerCase().trim());

  const hasIdentifier = keysLower.some((k) => ["id", "epc", "rfid", "uuid"].includes(k));
  const hasBib = keysLower.some((k) => ["bib", "no_bib", "no"].includes(k));
  const hasName = keysLower.some((k) => ["name", "nama"].includes(k));
  const hasCategory = keysLower.some((k) => ["category", "kategori"].includes(k));

  const missing: string[] = [];
  if (!hasIdentifier) missing.push("epc / id");
  if (!hasBib) missing.push("bib");
  if (!hasName) missing.push("name");
  if (!hasCategory) missing.push("category");

  if (missing.length > 0) {
    return { data: null, errors: [`Kolom wajib hilang: ${missing.join(", ")}`] };
  }

  const list: Participant[] = [];
  const byId = new Map<string, Participant>();
  const byBib = new Map<string, Participant>();
  const byEpc = new Map<string, Participant>();

  for (const row of rows) {
    const rawEpc = getRowValue(row, "epc", "rfid");
    const rawId = getRowValue(row, "id", "uuid");
    const bib = getRowValue(row, "bib", "no_bib", "no");
    const name = getRowValue(row, "name", "nama");
    const category = getRowValue(row, "category", "kategori");
    const gender = getRowValue(row, "gender", "jenis_kelamin", "jk");
    const tshirtSize = getRowValue(row, "tshirtSize", "tshirtsize", "tshirt_size", "size", "ukuran");
    const paymentStatus = getRowValue(row, "paymentStatus", "paymentstatus", "payment_status", "status") || "settlement";

    const epc = rawEpc ? rawEpc.toUpperCase() : undefined;
    const id = (rawId || epc || bib).toLowerCase();

    const p: Participant = {
      id,
      epc,
      bib,
      name,
      category,
      gender,
      tshirtSize,
      paymentStatus,
    };

    if (p.id || p.bib || p.epc) {
      list.push(p);
      if (p.id) byId.set(p.id.toLowerCase(), p);
      if (p.bib) byBib.set(p.bib.toLowerCase(), p);
      if (p.epc) {
        byEpc.set(p.epc.toUpperCase(), p);
        byEpc.set(p.epc.toLowerCase(), p);
      }
    }
  }

  return {
    data: {
      list,
      byId,
      byBib,
      byEpc,
      fileName,
    },
    errors: [],
  };
}

export function parseCsv(text: string, fileName = "data.csv"): { data: CsvData | null; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return buildData(parsed.data, fileName);
}

export async function parseFile(file: File): Promise<{ data: CsvData | null; errors: string[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    const text = await file.text();
    return parseCsv(text, file.name);
  }

  if (ext === "xlsx" || ext === "xls") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
            raw: false,
            defval: "",
          });
          const normalized = rows.map((row) =>
            Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), String(v).trim()]))
          );
          resolve(buildData(normalized, file.name));
        } catch (err) {
          resolve({ data: null, errors: [`Gagal membaca Excel: ${err}`] });
        }
      };
      reader.onerror = () => resolve({ data: null, errors: ["Gagal membaca file"] });
      reader.readAsArrayBuffer(file);
    });
  }

  return { data: null, errors: ["Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls"] };
}

/**
 * Extracts EPC, BIB, or UUID from raw reader payloads or scanner inputs.
 * Supports:
 * - JSON Array from UHF readers: [{"i":"SENSOR_01","e":"E280116060000204A8B9C101",...}]
 * - JSON Object: {"e":"E280116060000204A8B9C101"} or {"code":"1017"}
 * - URL QR: https://.../verify/<uuid>
 * - Raw EPC Hex string (e.g. E280116060000204A8B9C101)
 * - Raw BIB number (e.g. 1017)
 */
export function extractLookup(raw: string): Lookup {
  const s = raw.trim();

  // 1. JSON string detection (Array or Object)
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      let target: Record<string, unknown> | null = null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        target = parsed[0];
      } else if (parsed && typeof parsed === "object") {
        target = parsed as Record<string, unknown>;
      }

      if (target) {
        const epc = target.e ?? target.epc ?? target.EPC ?? target.rfid ?? target.RFID;
        if (epc) {
          const epcClean = String(epc).trim().toUpperCase();
          return { epc: epcClean, cleanedCode: epcClean };
        }

        const bib = target.bib ?? target.BIB ?? target.no;
        if (bib) {
          const bibClean = String(bib).trim();
          return { bib: bibClean.toLowerCase(), cleanedCode: bibClean };
        }

        const code = target.code ?? target.id ?? target.data;
        if (code) {
          return extractLookup(String(code));
        }
      }
    } catch {
      // Regex fallback if JSON is truncated
      const matchEpc = s.match(/"(?:e|epc|rfid)"\s*:\s*"([^"]+)"/i);
      if (matchEpc) {
        const epcClean = matchEpc[1].trim().toUpperCase();
        return { epc: epcClean, cleanedCode: epcClean };
      }
      const matchBib = s.match(/"(?:bib|code)"\s*:\s*"([^"]+)"/i);
      if (matchBib) {
        const bibClean = matchBib[1].trim();
        return { bib: bibClean.toLowerCase(), cleanedCode: bibClean };
      }
    }
  }

  // 2. QR code with /verify/<uuid>
  const uuidMatch = s.match(UUID_RE);
  if (uuidMatch) {
    const id = uuidMatch[0].toLowerCase();
    return { id, cleanedCode: id };
  }

  // 3. Hex EPC string (16-32 hex characters)
  if (EPC_HEX_RE.test(s)) {
    const epc = s.toUpperCase();
    return { epc, cleanedCode: epc };
  }

  // 4. Default: treat as bib or identifier
  return { bib: s.toLowerCase(), cleanedCode: s };
}

export const SAMPLE_CSV_RAW = `epc,bib,name,category,gender,tshirtSize,paymentStatus
E280116060000204A8B9C101,1017,Budi Santoso,10K,M,L,settlement
E280116060000204A8B9C102,1018,"Aminah, Siti",10K,F,S,pending
E280116060000204A8B9C103,2019,Joko Anwar,5K,M,M,settlement
E280116060000204A8B9C104,2020,Rina Marlina,5K,F,S,settlement
E280116060000204A8B9C105,3021,Farid Ghani,21K,M,XL,settlement
E280116060000204A8B9C106,4042,Dewi Sartika,42K,F,M,settlement`;

export function getSampleData(): CsvData {
  const res = parseCsv(SAMPLE_CSV_RAW, "sample-data.csv");
  return res.data!;
}
