import { categorizar } from "../categorize";
import { parseDataBr, parseValorBr } from "./valores";
import type { TransacaoImportada } from "./excel";

// Import direto do módulo interno para evitar o código de debug do entrypoint
// do pdf-parse, que tenta ler um arquivo de teste quando importado via ESM.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (b: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");

const IGNORAR = [
  "pagamento recebido", "pagamento em", "pagamento de fatura", "saldo anterior",
  "credito de", "crédito de", "estorno", "total da fatura", "limite",
  "vencimento", "juros", "iof", "anuidade diferenciada",
];

/**
 * Extrai transações de um PDF de fatura de cartão.
 * Procura linhas com padrão: data + descrição + valor (formatos comuns de
 * Nubank, Itaú, Bradesco, Santander, C6, Inter etc.).
 */
export async function parsePdf(buffer: Buffer): Promise<TransacaoImportada[]> {
  const { text } = await pdfParse(buffer);
  const linhas = text.split(/\r?\n/);
  const resultado: TransacaoImportada[] = [];

  // Tenta detectar o ano da fatura no texto
  const anoMatch = text.match(/\b(20\d{2})\b/);
  const anoRef = anoMatch ? parseInt(anoMatch[1], 10) : new Date().getFullYear();

  const padroes = [
    // 12/03/2025 DESCRICAO 123,45  |  12/03 DESCRICAO R$ 123,45
    /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
    // 12 ABR DESCRICAO 123,45 (Nubank)
    /^(\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?)\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i,
  ];

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) continue;

    for (const padrao of padroes) {
      const m = linha.match(padrao);
      if (!m) continue;

      const data = parseDataBr(m[1], anoRef);
      const valor = parseValorBr(m[3]);
      let descricao = m[2].trim().replace(/\s{2,}/g, " ");
      if (!data || valor === null || valor <= 0 || descricao.length < 2) break;

      const descLower = descricao.toLowerCase();
      if (IGNORAR.some((p) => descLower.includes(p))) break;

      // Extrai parcela do tipo "3/10" no fim da descrição
      let parcela: string | undefined;
      const mParc = descricao.match(/\b(\d{1,2}\/\d{1,2})\s*$/);
      if (mParc) {
        parcela = mParc[1];
        descricao = descricao.slice(0, mParc.index).trim();
      }

      resultado.push({
        data,
        descricao,
        valor,
        categoria: categorizar(descricao),
        parcela,
      });
      break;
    }
  }

  return resultado;
}
