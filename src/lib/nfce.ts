/**
 * Interpretação do QR Code de NFC-e (Nota Fiscal de Consumidor Eletrônica).
 *
 * O QR Code contém uma URL de consulta da SEFAZ. Formatos comuns:
 *  - v2: https://.../qrcode?p=CHAVE|versao|tpAmb|[diaEmi|vNF|digest|]cIdToken|hash
 *  - v1: https://.../qrcode?chNFe=CHAVE&nVersao=...&dhEmi=HEX&vNF=123.45&...
 */

const UFS: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
  "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB",
  "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
  "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS",
  "51": "MT", "52": "GO", "53": "DF",
};

export interface DadosNfce {
  chaveAcesso: string;
  urlConsulta: string;
  uf?: string;
  emitenteCnpj?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string; // ISO
  valorTotal?: number;
}

function hexParaTexto(hex: string): string | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

/** Decodifica os campos embutidos na chave de acesso de 44 dígitos. */
export function decodificarChave(chave: string): Partial<DadosNfce> {
  // cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) DV(1)
  const cUF = chave.slice(0, 2);
  const aamm = chave.slice(2, 6);
  const cnpj = chave.slice(6, 20);
  const serie = chave.slice(22, 25);
  const numero = chave.slice(25, 34);
  const ano = 2000 + parseInt(aamm.slice(0, 2), 10);
  const mes = aamm.slice(2, 4);
  return {
    uf: UFS[cUF],
    emitenteCnpj: cnpj,
    serie: String(parseInt(serie, 10)),
    numero: String(parseInt(numero, 10)),
    // Mês/ano de emissão pela chave (dia exato pode vir do QR v1/v2 offline)
    dataEmissao: `${ano}-${mes}-01T00:00:00Z`,
  };
}

/** Remove tudo que não for dígito (aceita chave colada com espaços/pontos). */
export function normalizarChave(entrada: string): string {
  return entrada.replace(/\D/g, "");
}

/** Valida o dígito verificador (módulo 11) da chave de acesso de 44 dígitos. */
export function validarChave(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += parseInt(chave[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === parseInt(chave[43], 10);
}

export function interpretarQrCodeNfce(conteudo: string): DadosNfce | null {
  const texto = conteudo.trim();

  // Procura a chave de acesso (44 dígitos) em qualquer formato
  const matchChave = texto.replace(/[^0-9|&=?]/g, " ").match(/\d{44}/);
  const matchChaveUrl = texto.match(/(?:chNFe=|p=)(\d{44})/i) || matchChave;
  if (!matchChaveUrl) return null;
  const chave = Array.isArray(matchChaveUrl) ? matchChaveUrl[1] || matchChaveUrl[0] : "";
  if (!/^\d{44}$/.test(chave)) return null;

  const dados: DadosNfce = {
    chaveAcesso: chave,
    urlConsulta: texto.startsWith("http") ? texto : "",
    ...decodificarChave(chave),
  };

  // Formato v1 (query string)
  const vNF = texto.match(/[?&]vNF=([\d.]+)/i);
  if (vNF) dados.valorTotal = parseFloat(vNF[1]);
  const dhEmi = texto.match(/[?&]dhEmi=([0-9a-fA-F]+)/i);
  if (dhEmi) {
    const decodificado = hexParaTexto(dhEmi[1]);
    if (decodificado && !isNaN(Date.parse(decodificado))) {
      dados.dataEmissao = new Date(decodificado).toISOString();
    }
  }

  // Formato v2 (parâmetro p= separado por pipes)
  const p = texto.match(/[?&]p=([^&\s]+)/i);
  if (p) {
    const partes = decodeURIComponent(p[1]).split("|");
    // Emissão offline: chave|versao|tpAmb|diaEmi|vNF|digest|cIdToken|hash
    if (partes.length >= 5 && /^\d+([.,]\d+)?$/.test(partes[4])) {
      dados.valorTotal = parseFloat(partes[4].replace(",", "."));
      const dia = parseInt(partes[3], 10);
      if (dia >= 1 && dia <= 31 && dados.dataEmissao) {
        const d = new Date(dados.dataEmissao);
        d.setUTCDate(dia);
        dados.dataEmissao = d.toISOString();
      }
    }
  }

  return dados;
}
