import { decodificarChave, interpretarQrCodeNfce, normalizarChave, validarChave } from "./nfce";
import type { DadosNfce } from "./nfce";
import { inserirNota, inserirTransacoes, registrarEvento } from "./dados";
import { PONTOS } from "./gamification";
import type { NotaFiscal } from "./types";

export interface ResultadoRegistro {
  ok: boolean;
  status: number;
  erro?: string;
  jaExistia?: boolean;
  nota?: NotaFiscal;
  dados?: DadosNfce;
}

async function persistir(dados: DadosNfce): Promise<ResultadoRegistro> {
  const { nota, jaExistia } = await inserirNota({
    chave_acesso: dados.chaveAcesso,
    url_consulta: dados.urlConsulta || null,
    emitente_cnpj: dados.emitenteCnpj ?? null,
    numero: dados.numero ?? null,
    serie: dados.serie ?? null,
    uf: dados.uf ?? null,
    data_emissao: dados.dataEmissao ?? null,
    valor_total: dados.valorTotal ?? null,
  });

  if (!jaExistia) {
    await registrarEvento("nota_registrada", PONTOS.NOTA_REGISTRADA, `NFC-e ${dados.chaveAcesso}`);

    if (dados.valorTotal && dados.dataEmissao) {
      await inserirTransacoes(
        [
          {
            data: dados.dataEmissao.slice(0, 10),
            descricao: `NFC-e ${dados.numero ?? ""} CNPJ ${dados.emitenteCnpj ?? ""}`.trim(),
            valor: dados.valorTotal,
            categoria: "Mercado",
          },
        ],
        "nfce"
      );
    }
  }

  return { ok: true, status: 200, jaExistia, nota, dados };
}

/** Registra uma nota a partir do conteúdo decodificado de um QR Code. */
export async function registrarNotaDeQr(conteudo: string): Promise<ResultadoRegistro> {
  const dados = interpretarQrCodeNfce(conteudo);
  if (!dados) {
    return {
      ok: false,
      status: 422,
      erro: "O QR Code lido não parece ser de uma NFC-e.",
    };
  }
  return persistir(dados);
}

/** Registra uma nota a partir da chave de acesso digitada manualmente. */
export async function registrarNotaPorChave(
  entrada: string,
  opcoes?: { valorTotal?: number; dataEmissao?: string }
): Promise<ResultadoRegistro> {
  const chave = normalizarChave(entrada);
  if (chave.length !== 44) {
    return {
      ok: false,
      status: 400,
      erro: `A chave de acesso deve ter 44 dígitos (você enviou ${chave.length}).`,
    };
  }
  if (!validarChave(chave)) {
    return {
      ok: false,
      status: 400,
      erro: "Chave de acesso inválida (dígito verificador não confere). Confira os números digitados.",
    };
  }

  const dados: DadosNfce = {
    chaveAcesso: chave,
    urlConsulta: "",
    ...decodificarChave(chave),
  };
  if (opcoes?.valorTotal && opcoes.valorTotal > 0) dados.valorTotal = opcoes.valorTotal;
  if (opcoes?.dataEmissao && !isNaN(Date.parse(opcoes.dataEmissao))) {
    dados.dataEmissao = new Date(opcoes.dataEmissao).toISOString();
  }

  return persistir(dados);
}
