import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedTabularFile = {
  headers: string[];
  rows: Record<string, any>[];
  /** original row index in file (1-based). Useful for error logs. */
  rowNumbers: number[];
};

function normalizeHeader(h: string) {
  return (h || "").trim();
}

export async function parseTabularFile(file: File): Promise<ParsedTabularFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const headerRow = (raw[0] || []).map((x) => normalizeHeader(String(x)));
    const headers = headerRow.filter(Boolean);
    const rows: Record<string, any>[] = [];
    const rowNumbers: number[] = [];
    for (let i = 1; i < raw.length; i++) {
      const line = raw[i] || [];
      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) obj[headers[j]] = line[j] ?? "";
      // skip empty rows
      if (Object.values(obj).every((v) => String(v ?? "").trim() === "")) continue;
      rows.push(obj);
      rowNumbers.push(i + 1); // 1-based row number in file
    }
    return { headers, rows, rowNumbers };
  }

  // default: CSV
  const text = await file.text();
  const parsed = Papa.parse<Record<string, any>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const headers = (parsed.meta.fields || []).map((h) => normalizeHeader(String(h))).filter(Boolean);
  const rows = (parsed.data || []) as Record<string, any>[];
  const rowNumbers: number[] = [];
  // Papa header=true: first data row is line 2
  for (let i = 0; i < rows.length; i++) rowNumbers.push(i + 2);
  return { headers, rows, rowNumbers };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: any[], filename: string) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export function downloadXlsx(rows: any[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

export function guessMapping(headers: string[], aliases: Record<string, string[]>) {
  const lower = headers.map((h) => h.toLowerCase());
  const map: Record<string, string> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const candidates = names.map((x) => x.toLowerCase());
    const idx = lower.findIndex((h) => candidates.includes(h));
    if (idx >= 0) map[field] = headers[idx];
  }
  return map;
}
