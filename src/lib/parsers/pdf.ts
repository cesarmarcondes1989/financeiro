import { categorizar } from "../categorize";
import { parseDataBr, parseValorBr } from "./valores";
import type { TransacaoImportada } from "./excel";

// Import direto do módulo interno para evitar o código de debug do entrypoint
// do pdf-parse, que tenta ler um arquivo de teste quando importado via ESM.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (b: Buffer, o?: { version?: string }) => Promise<{ text: string }> =
  require("pdf-parse/lib/pdf-parse.js");

/** O pdf.js padrão do pdf-parse (2018) falha em PDFs modernos ("bad XRef
 *  entry"); a v2.0.550 embutida lê muito mais formatos, então tentamos as duas. */
async function extrairTexto(buffer: Buffer): Promise<string> {
  let ultimoErro: unknown;
  for (const version of ["v2.0.550", "default"]) {
    try {
      const { text } = await pdfParse(buffer, { version });
      if (text && text.trim()) return text;
    } catch (e) {
      ultimoErro = e;
    }
  }
  if (ultimoErro) throw ultimoErro;
  return "";
}

const IGNORAR = [
  "pagamento recebido", "pagamento em", "pagamento de fatura", "pagamento efetuado",
  "pagamentos", "saldo anterior", "saldo em aberto", "credito de", "crédito de",
  "estorno", "total da fatura", "total desta fatura", "limite", "vencimento",
  "juros", "iof", "encargos", "anuidade diferenciada", "valor minimo",
  "valor mínimo", "fatura anterior", "saldo financiado",
];

const RE_DATA = String.raw`(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\.?(?:\s+\d{4})?)`;
const RE_VALOR = String.raw`(?:R\$\s*)?(-?\s?\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)`;

export class PdfSemTextoError extends Error {
  constructor() {
    super(
      "O PDF não contém texto extraível — provavelmente é digitalizado (imagem) ou protegido por senha. " +
        "Dica: gere o PDF pelo app do banco (sem senha) ou exporte a fatura como Excel/CSV."
    );
  }
}

function descricaoValida(desc: string): boolean {
  if (desc.length < 2 || desc.length > 120) return false;
  if (!/[a-zA-ZÀ-ú]{2,}/.test(desc)) return false;
  const lower = desc.toLowerCase();
  return !IGNORAR.some((p) => lower.includes(p));
}

function extrairParcela(desc: string): { descricao: string; parcela?: string } {
  const m = desc.match(/(?:Parc(?:ela)?\s*)?\b(\d{1,2}\s*(?:\/|de)\s*\d{1,2})\s*$/i);
  if (m) {
    return {
      descricao: desc.slice(0, m.index).trim().replace(/[-–]\s*$/, "").trim(),
      parcela: m[1].replace(/\s*(?:de|\/)\s*/i, "/"),
    };
  }
  return { descricao: desc };
}

function montar(
  dataBruta: string,
  descBruta: string,
  valorBruto: string,
  anoRef: number
): TransacaoImportada | null {
  const data = parseDataBr(dataBruta.toLowerCase(), anoRef);
  const valor = parseValorBr(valorBruto.replace(/\s/g, ""));
  const limpa = descBruta.trim().replace(/\s{2,}/g, " ");
  if (!data || valor === null || valor <= 0 || !descricaoValida(limpa)) return null;
  const { descricao, parcela } = extrairParcela(limpa);
  if (!descricaoValida(descricao)) return null;
  return { data, descricao, valor, categoria: categorizar(descricao), parcela };
}

/**
 * Extrai transações de um PDF de fatura de cartão.
 *
 * Estratégias, em ordem:
 *  1) data + descrição + valor na MESMA linha (busca global, em qualquer
 *     posição da linha, e múltiplas ocorrências por linha);
 *  2) campos em LINHAS SEPARADAS (alguns PDFs quebram cada coluna em uma
 *     linha): uma linha só com a data, descrição nas seguintes e valor em
 *     até 4 linhas adiante.
 */
export async function parsePdf(buffer: Buffer): Promise<TransacaoImportada[]> {
  let text: string;
  try {
    text = await extrairTexto(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password|encrypt/i.test(msg)) throw new PdfSemTextoError();
    throw e;
  }

  if (!text || text.replace(/\s/g, "").length < 40) throw new PdfSemTextoError();
  return extrairTransacoesDoTexto(text);
}

/** Extrai transações do texto bruto de uma fatura (exportado para testes). */
export function extrairTransacoesDoTexto(text: string): TransacaoImportada[] {
  const linhas = text.split(/\r?\n/).map((l) => l.trim());
  const anoMatch = text.match(/\b(20\d{2})\b/);
  const anoRef = anoMatch ? parseInt(anoMatch[1], 10) : new Date().getFullYear();

  const vistos = new Set<string>();
  const resultado: TransacaoImportada[] = [];
  const adicionar = (t: TransacaoImportada | null) => {
    if (!t) return;
    const chave = `${t.data}|${t.descricao.toLowerCase()}|${t.valor}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    resultado.push(t);
  };

  // Estratégia 1 — mesma linha (global, múltiplas transações por linha)
  const reMesmaLinha = new RegExp(`${RE_DATA}\\s+(.{2,120}?)\\s*${RE_VALOR}`, "gi");
  for (const linha of linhas) {
    if (!linha) continue;
    for (const m of linha.matchAll(reMesmaLinha)) {
      adicionar(montar(m[1], m[2], m[3], anoRef));
    }
  }

  // Estratégia 2 — campos em linhas separadas
  if (resultado.length === 0) {
    const reSoData = new RegExp(`^${RE_DATA}$`, "i");
    const reSoValor = new RegExp(`^${RE_VALOR}$`);
    for (let i = 0; i < linhas.length; i++) {
      const mData = linhas[i].match(reSoData);
      if (!mData) continue;
      for (let j = i + 1; j <= Math.min(i + 4, linhas.length - 1); j++) {
        const mValor = linhas[j].match(reSoValor);
        if (!mValor) continue;
        const desc = linhas.slice(i + 1, j).join(" ").trim();
        adicionar(montar(mData[1], desc, mValor[1], anoRef));
        i = j;
        break;
      }
    }
  }

  return resultado;
}
