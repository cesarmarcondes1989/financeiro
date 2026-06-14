import { decodificarChave, interpretarQrCodeNfce, normalizarChave, validarChave } from "./nfce";
import type { DadosNfce } from "./nfce";
import {
  atualizarNota,
  contarItensNota,
  inserirItensNota,
  inserirNota,
  inserirTransacoes,
  registrarEvento,
} from "./dados";
import { consultarNfceNaSefaz } from "./sefaz";
import type { DadosSefaz } from "./sefaz";
import { categorizar } from "./categorize";
import { categorizarLote } from "./ai-categorize";
import { PONTOS } from "./gamification";
import type { NotaFiscal } from "./types";

export interface ResultadoRegistro {
  ok: boolean;
  status: number;
  erro?: string;
  jaExistia?: boolean;
  nota?: NotaFiscal;
  dados?: DadosNfce;
  /** Quantos itens vieram da consulta automática na SEFAZ */
  itensImportados?: number;
  /** Valor total final (do QR ou da SEFAZ) */
  valorTotal?: number;
}

/** Lança o gasto da nota como transação (descrição = estabelecimento). */
async function lancarTransacao(
  dados: DadosNfce,
  sefaz: DadosSefaz | null
): Promise<void> {
  const valor = sefaz?.valorTotal ?? dados.valorTotal;
  const dataEmissao = sefaz?.dataEmissao ?? dados.dataEmissao;
  if (!valor || !dataEmissao) return;

  const descricao =
    sefaz?.emitenteNome?.trim() ||
    `NFC-e ${dados.numero ?? ""} CNPJ ${dados.emitenteCnpj ?? ""}`.trim();

  await inserirTransacoes(
    [
      {
        data: dataEmissao.slice(0, 10),
        descricao,
        valor,
        categoria: sefaz?.emitenteNome ? categorizar(sefaz.emitenteNome) : "Mercado",
      },
    ],
    "nfce"
  );
}

/** Salva no banco os dados completos vindos da SEFAZ (nota + itens). */
async function aplicarDadosSefaz(notaId: string, sefaz: DadosSefaz): Promise<number> {
  await atualizarNota(notaId, {
    emitente_nome: sefaz.emitenteNome ?? null,
    ...(sefaz.emitenteCnpj ? { emitente_cnpj: sefaz.emitenteCnpj } : {}),
    ...(sefaz.municipio ? { municipio: sefaz.municipio } : {}),
    ...(sefaz.dataEmissao ? { data_emissao: sefaz.dataEmissao } : {}),
    ...(sefaz.valorTotal ? { valor_total: sefaz.valorTotal } : {}),
  });

  if (!sefaz.itens.length) return 0;
  const existentes = await contarItensNota(notaId);
  if (existentes > 0) return 0; // já importados antes — não duplica

  // Categoriza todos os itens em lote via IA (ou keyword como fallback)
  const descricoes = sefaz.itens.map((i) => i.descricao);
  const categoriasAi = await categorizarLote(descricoes).catch(() => ({} as Record<string, string>));

  const inseridos = await inserirItensNota(
    notaId,
    sefaz.itens.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valorUnitario ?? (i.quantidade > 0 ? i.valorTotal / i.quantidade : null),
      valor_total: i.valorTotal,
      categoria: categoriasAi[i.descricao] ?? categorizar(i.descricao),
    }))
  );
  if (inseridos > 0) {
    await registrarEvento(
      "itens_importados",
      PONTOS.ITENS_IMPORTADOS,
      `${inseridos} itens importados da SEFAZ`
    );
  }
  return inseridos;
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

  if (jaExistia) {
    // Nota já registrada: se ainda está sem itens e temos a URL do QR,
    // aproveita o novo escaneamento para tentar importar da SEFAZ.
    const resultado: ResultadoRegistro = { ok: true, status: 200, jaExistia, nota, dados };
    const url = nota.url_consulta || dados.urlConsulta;
    if (url) {
      try {
        // Nota registrada antes pela chave digitada ganha agora a URL do QR
        if (!nota.url_consulta && dados.urlConsulta) {
          await atualizarNota(nota.id, { url_consulta: dados.urlConsulta });
        }
        const existentes = await contarItensNota(nota.id);
        if (existentes === 0) {
          const r = await importarDaSefaz({ ...nota, url_consulta: url });
          if (r.ok) {
            resultado.itensImportados = r.itensImportados;
            resultado.valorTotal = r.valorTotal;
          }
        }
      } catch {
        // melhor esforço — a resposta de "já existia" continua válida
      }
    }
    return resultado;
  }

  await registrarEvento("nota_registrada", PONTOS.NOTA_REGISTRADA, `NFC-e ${dados.chaveAcesso}`);

  // Busca os dados completos (emitente, total e itens) na página da SEFAZ.
  // Melhor esforço: se o portal estiver fora ou o layout for diferente,
  // a nota fica registrada mesmo assim.
  let sefaz: DadosSefaz | null = null;
  let itensImportados = 0;
  if (dados.urlConsulta) {
    sefaz = await consultarNfceNaSefaz(dados.urlConsulta);
    if (sefaz) {
      try {
        itensImportados = await aplicarDadosSefaz(nota.id, sefaz);
      } catch {
        // mantém a nota registrada mesmo se a gravação extra falhar
      }
    }
  }

  await lancarTransacao(dados, sefaz);

  return {
    ok: true,
    status: 200,
    jaExistia: false,
    nota,
    dados,
    itensImportados,
    valorTotal: sefaz?.valorTotal ?? dados.valorTotal,
  };
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

/** Reconsulta a SEFAZ para uma nota já registrada (botão na página da nota). */
export async function importarDaSefaz(nota: NotaFiscal): Promise<ResultadoRegistro> {
  if (!nota.url_consulta) {
    return {
      ok: false,
      status: 400,
      erro:
        "Esta nota foi registrada pela chave digitada e não tem a URL do QR Code — " +
        "a consulta automática na SEFAZ só funciona com a URL completa do QR. " +
        "Lance os itens manualmente abaixo.",
    };
  }

  const sefaz = await consultarNfceNaSefaz(nota.url_consulta);
  if (!sefaz) {
    return {
      ok: false,
      status: 422,
      erro:
        "Não foi possível ler os dados no portal da SEFAZ (portal fora do ar ou layout não reconhecido). " +
        "Tente novamente mais tarde ou lance os itens manualmente.",
    };
  }

  const tinhaValor = nota.valor_total != null;
  const itensImportados = await aplicarDadosSefaz(nota.id, sefaz);

  // Se a nota ainda não tinha valor, o gasto ainda não tinha sido lançado
  if (!tinhaValor && sefaz.valorTotal) {
    const dados: DadosNfce = {
      chaveAcesso: nota.chave_acesso,
      urlConsulta: nota.url_consulta ?? "",
      emitenteCnpj: nota.emitente_cnpj ?? undefined,
      numero: nota.numero ?? undefined,
      dataEmissao: nota.data_emissao ?? undefined,
    };
    await lancarTransacao(dados, sefaz);
  }

  return {
    ok: true,
    status: 200,
    itensImportados,
    valorTotal: sefaz.valorTotal,
  };
}
