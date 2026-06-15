import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Diagnóstico completo do JOIN itens_nota → notas_fiscais.
 * Mostra a verdade dos dados, sem agregação, para achar onde o emitente se perde.
 * GET /api/admin/diagnostico
 */
export async function GET() {
  const sb = getSupabase();

  // 1. Estado bruto da tabela notas_fiscais
  const { data: notas, error: errNotas } = await sb
    .from("notas_fiscais")
    .select("id, emitente_nome, valor_total, data_emissao")
    .limit(1000);

  // 2. Estado bruto da tabela itens_nota
  const { data: itens, error: errItens } = await sb
    .from("itens_nota")
    .select("id, nota_id, descricao")
    .limit(1000);

  const notasComEmitente = (notas ?? []).filter((n) => n.emitente_nome);
  const notasSemEmitente = (notas ?? []).filter((n) => !n.emitente_nome);

  // 3. Conjunto de ids reais das notas
  const idsNotas = new Set((notas ?? []).map((n) => String(n.id)));

  // 4. Para cada item, o nota_id aponta para uma nota existente? Essa nota tem emitente?
  const notaPorId: Record<string, { emitente_nome: string | null; valor_total: unknown }> = {};
  for (const n of notas ?? []) {
    notaPorId[String(n.id)] = {
      emitente_nome: (n.emitente_nome as string | null) ?? null,
      valor_total: n.valor_total,
    };
  }

  let itensComNotaExistente = 0;
  let itensComNotaInexistente = 0;
  let itensCujaNotaTemEmitente = 0;
  const amostraItens: Array<{
    descricao: string;
    nota_id: string;
    nota_existe: boolean;
    emitente_da_nota: string | null;
  }> = [];

  for (const it of itens ?? []) {
    const nid = String(it.nota_id);
    const existe = idsNotas.has(nid);
    if (existe) {
      itensComNotaExistente++;
      if (notaPorId[nid]?.emitente_nome) itensCujaNotaTemEmitente++;
    } else {
      itensComNotaInexistente++;
    }
    if (amostraItens.length < 15) {
      amostraItens.push({
        descricao: it.descricao as string,
        nota_id: nid,
        nota_existe: existe,
        emitente_da_nota: existe ? notaPorId[nid]?.emitente_nome ?? null : null,
      });
    }
  }

  return NextResponse.json({
    erros: {
      notas: errNotas?.message ?? null,
      itens: errItens?.message ?? null,
    },
    notas_fiscais: {
      total: notas?.length ?? 0,
      com_emitente: notasComEmitente.length,
      sem_emitente: notasSemEmitente.length,
      amostra: (notas ?? []).slice(0, 10).map((n) => ({
        id: String(n.id),
        emitente_nome: n.emitente_nome ?? null,
        valor_total: n.valor_total,
        data_emissao: n.data_emissao,
      })),
    },
    itens_nota: {
      total: itens?.length ?? 0,
      com_nota_existente: itensComNotaExistente,
      com_nota_inexistente: itensComNotaInexistente,
      cuja_nota_tem_emitente: itensCujaNotaTemEmitente,
    },
    amostra_join: amostraItens,
  });
}
