import { parseValorBr } from "./parsers/valores";

/**
 * Consulta a página pública da SEFAZ apontada pelo QR Code da NFC-e e extrai
 * os dados completos da nota (emitente, data, total e itens).
 *
 * A maioria dos estados usa o mesmo layout nacional de DANFE NFC-e online,
 * com as classes CSS txtTopo (emitente), txtTit (item), Rqtd, RvlUnit, valor
 * e txtMax (total). A consulta via URL do QR dispensa captcha porque o hash
 * presente na URL autentica a requisição.
 */

export interface ItemSefaz {
  descricao: string;
  quantidade: number;
  valorUnitario: number | null;
  valorTotal: number;
}

export interface DadosSefaz {
  emitenteNome?: string;
  emitenteCnpj?: string;
  municipio?: string;
  dataEmissao?: string; // ISO
  valorTotal?: number;
  itens: ItemSefaz[];
}

function semTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capturar(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? semTags(m[1]) : null;
}

export function extrairDadosDoHtml(html: string): DadosSefaz | null {
  const dados: DadosSefaz = { itens: [] };

  // Emitente: <div class="txtTopo">NOME</div>
  dados.emitenteNome = capturar(html, /class="txtTopo"[^>]*>([\s\S]*?)<\/(?:div|span|h\d)>/i) ?? undefined;

  const textoCompleto = semTags(html);

  const cnpj = textoCompleto.match(/CNPJ[:\s]*([\d]{2}\.?[\d]{3}\.?[\d]{3}\/?[\d]{4}-?[\d]{2})/i);
  if (cnpj) dados.emitenteCnpj = cnpj[1].replace(/\D/g, "");

  // Município: tenta "Município: CITY" ou padrão "CIDADE/UF" no endereço do emitente
  const mLabel = textoCompleto.match(/Munic[íi]pio[:\s]+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{1,50}?)(?=\s*(?:CEP|CNPJ|\d{5}|UF|Emiss|\/[A-Z]{2}|\s{4}))/i);
  if (mLabel) {
    dados.municipio = mLabel[1].trim().toUpperCase();
  } else {
    // Captura "CIDADE/SP" — padrão comum em endereços NFC-e
    const mCidade = textoCompleto.match(/\b([A-ZÀ-Ú][A-ZÀ-Ú\s]{2,40})\/([A-Z]{2})\b/);
    if (mCidade && !/CNPJ|CPF|http|www|N[ºo°]|Via|Acesso/i.test(mCidade[0])) {
      dados.municipio = mCidade[1].trim();
    }
  }

  // Emissão: 10/06/2026 18:30:21
  const emissao = textoCompleto.match(/Emiss[ãa]o[:\s]*(\d{2}\/\d{2}\/\d{4})[\s,]*(\d{2}:\d{2}(?::\d{2})?)?/i);
  if (emissao) {
    const [dia, mes, ano] = emissao[1].split("/");
    const hora = emissao[2] ?? "12:00:00";
    const iso = new Date(`${ano}-${mes}-${dia}T${hora.length === 5 ? hora + ":00" : hora}-03:00`);
    if (!isNaN(iso.getTime())) dados.dataEmissao = iso.toISOString();
  }

  // Total: <span class="totalNumb txtMax">23,50</span> (Valor a pagar)
  const totalMax = capturar(html, /class="totalNumb txtMax"[^>]*>([\s\S]*?)<\/span>/i);
  const totalFallback =
    totalMax ??
    textoCompleto.match(/Valor a pagar R?\$?:?\s*([\d.,]+)/i)?.[1] ??
    textoCompleto.match(/Valor total R?\$?:?\s*([\d.,]+)/i)?.[1] ??
    null;
  if (totalFallback) {
    const v = parseValorBr(totalFallback);
    if (v !== null && v > 0) dados.valorTotal = v;
  }

  // Itens: linhas da tabela #tabResult com classes txtTit/Rqtd/RvlUnit/valor
  const blocos = html.split(/<tr[\s>]/i);
  for (const bloco of blocos) {
    if (!/class="txtTit/i.test(bloco)) continue;
    const descricao = capturar(bloco, /class="txtTit2?"[^>]*>([\s\S]*?)<\/span>/i);
    if (!descricao) continue;

    const qtdBruta = capturar(bloco, /class="Rqtd"[^>]*>([\s\S]*?)<\/span>/i);
    const unitBruto = capturar(bloco, /class="RvlUnit"[^>]*>([\s\S]*?)<\/span>/i);
    const totalBruto = capturar(bloco, /class="valor"[^>]*>([\s\S]*?)<\/span>/i);

    const quantidade = qtdBruta
      ? parseFloat(qtdBruta.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".")) || 1
      : 1;
    const valorUnitario = unitBruto ? parseValorBr(unitBruto.replace(/[^\d.,]/g, "")) : null;
    const valorTotal = totalBruto ? parseValorBr(totalBruto) : null;
    if (valorTotal === null || valorTotal <= 0) continue;

    dados.itens.push({ descricao, quantidade, valorUnitario, valorTotal });
  }

  // Considera a consulta bem-sucedida se achou itens ou o valor total
  if (!dados.itens.length && !dados.valorTotal) return null;
  return dados;
}

export async function consultarNfceNaSefaz(urlConsulta: string): Promise<DadosSefaz | null> {
  if (!urlConsulta?.startsWith("http")) return null;
  try {
    const resp = await fetch(urlConsulta, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    return extrairDadosDoHtml(html);
  } catch {
    return null;
  }
}
