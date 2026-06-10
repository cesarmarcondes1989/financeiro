/** Utilidades de parsing de valores e datas em formato brasileiro. */

export function parseValorBr(bruto: string | number): number | null {
  if (typeof bruto === "number") return isFinite(bruto) ? round2(bruto) : null;
  let s = bruto.trim().replace(/R\$\s*/i, "");
  if (!s) return null;
  const negativo = /^-|-$|^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/^-|-$/g, "").trim();
  // "1.234,56" -> 1234.56 | "1234.56" mantém | "1,234.56" (en) -> 1234.56
  if (/,\d{2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const v = parseFloat(s);
  if (isNaN(v)) return null;
  return round2(negativo ? -v : v);
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

/** Converte datas em "DD/MM/YYYY", "DD/MM", "DD MMM", serial Excel etc. para YYYY-MM-DD. */
export function parseDataBr(bruto: string | number | Date, anoReferencia?: number): string | null {
  const hoje = new Date();
  const anoRef = anoReferencia ?? hoje.getFullYear();

  if (bruto instanceof Date) {
    return isNaN(bruto.getTime()) ? null : bruto.toISOString().slice(0, 10);
  }
  if (typeof bruto === "number") {
    // Serial de data do Excel (dias desde 1899-12-30)
    if (bruto > 25000 && bruto < 60000) {
      const d = new Date(Math.round((bruto - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  const s = bruto.trim().toLowerCase();

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // DD/MM/YYYY
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})$/); // DD/MM (assume ano de referência)
  if (m) return `${anoRef}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s*(\d{4})?$/);
  if (m) {
    const ano = m[3] || String(anoRef);
    return `${ano}-${MESES[m[2]]}-${m[1].padStart(2, "0")}`;
  }

  return null;
}
