import * as XLSX from "xlsx";
import { categorizar } from "../categorize";
import { parseDataBr, parseValorBr } from "./valores";

export interface TransacaoImportada {
  data: string;
  descricao: string;
  valor: number;
  categoria: string;
  cartao?: string;
  parcela?: string;
}

const COLUNAS = {
  data: ["data", "date", "dia", "data da compra", "data compra"],
  descricao: [
    "descricao", "descrição", "description", "estabelecimento", "lancamento",
    "lançamento", "historico", "histórico", "title", "loja", "local",
  ],
  valor: ["valor", "amount", "value", "valor (r$)", "valor r$", "total"],
  categoria: ["categoria", "category"],
  cartao: ["cartao", "cartão", "card", "final do cartao", "final do cartão"],
  parcela: ["parcela", "parcelas", "installment"],
};

function acharColuna(headers: string[], candidatas: string[]): number {
  const norm = headers.map((h) => String(h ?? "").trim().toLowerCase());
  for (const c of candidatas) {
    const i = norm.indexOf(c);
    if (i >= 0) return i;
  }
  for (const c of candidatas) {
    const i = norm.findIndex((h) => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** Lê um arquivo Excel/CSV de fatura e extrai as transações. */
export function parseExcel(buffer: Buffer): TransacaoImportada[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const resultado: TransacaoImportada[] = [];

  for (const nomeAba of wb.SheetNames) {
    const linhas: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], {
      header: 1,
      defval: "",
    });
    if (!linhas.length) continue;

    // Encontra a linha de cabeçalho (primeira que tenha coluna de data e valor)
    let headerIdx = -1;
    let idx = { data: -1, descricao: -1, valor: -1, categoria: -1, cartao: -1, parcela: -1 };
    for (let i = 0; i < Math.min(linhas.length, 20); i++) {
      const headers = linhas[i].map(String);
      const tentativa = {
        data: acharColuna(headers, COLUNAS.data),
        descricao: acharColuna(headers, COLUNAS.descricao),
        valor: acharColuna(headers, COLUNAS.valor),
        categoria: acharColuna(headers, COLUNAS.categoria),
        cartao: acharColuna(headers, COLUNAS.cartao),
        parcela: acharColuna(headers, COLUNAS.parcela),
      };
      if (tentativa.data >= 0 && tentativa.valor >= 0 && tentativa.descricao >= 0) {
        headerIdx = i;
        idx = tentativa;
        break;
      }
    }
    if (headerIdx < 0) continue;

    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const linha = linhas[i];
      const data = parseDataBr(linha[idx.data] as string | number | Date);
      const valor = parseValorBr(linha[idx.valor] as string | number);
      const descricao = String(linha[idx.descricao] ?? "").trim();
      if (!data || valor === null || !descricao) continue;
      // Ignora estornos/pagamentos (valores negativos são créditos na fatura)
      if (valor <= 0) continue;

      resultado.push({
        data,
        descricao,
        valor,
        categoria:
          idx.categoria >= 0 && String(linha[idx.categoria]).trim()
            ? String(linha[idx.categoria]).trim()
            : categorizar(descricao),
        cartao: idx.cartao >= 0 ? String(linha[idx.cartao]).trim() || undefined : undefined,
        parcela: idx.parcela >= 0 ? String(linha[idx.parcela]).trim() || undefined : undefined,
      });
    }
  }

  return resultado;
}
