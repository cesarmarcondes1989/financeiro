import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Atualiza notas_fiscais.emitente_nome usando o nome do estabelecimento
 * já gravado em transacoes.descricao (origem = nfce, mesmo valor e data).
 *
 * GET /api/admin/corrigir-emitentes
 */
export async function GET() {
  const sb = getSupabase();

  // Busca todas as notas sem emitente que têm valor e data
  const { data: notas, error: errNotas } = await sb
    .from("notas_fiscais")
    .select("id, valor_total, data_emissao")
    .is("emitente_nome", null)
    .not("valor_total", "is", null)
    .not("data_emissao", "is", null)
    .limit(500);

  if (errNotas) return NextResponse.json({ erro: errNotas.message }, { status: 500 });
  if (!notas?.length) return NextResponse.json({ ok: true, mensagem: "Nenhuma nota pendente.", atualizadas: 0 });

  // Busca todas as transações NFC-e de uma vez
  const { data: transacoes, error: errTrans } = await sb
    .from("transacoes")
    .select("descricao, valor, data")
    .eq("origem", "nfce")
    .limit(5000);

  if (errTrans) return NextResponse.json({ erro: errTrans.message }, { status: 500 });

  const atualizadas: string[] = [];
  const semMatch: string[] = [];

  for (const nota of notas) {
    const dataStr = String(nota.data_emissao).slice(0, 10);
    const valor = Number(nota.valor_total);

    // Encontra transação com mesmo valor e data
    const trans = (transacoes ?? []).find(
      (t) =>
        String(t.data).slice(0, 10) === dataStr &&
        Math.abs(Number(t.valor) - valor) < 0.01
    );

    // Ignora descrições genéricas do tipo "NFC-e ... CNPJ ..."
    const nomeEstab = trans?.descricao;
    if (!nomeEstab || /^nfc-?e\s/i.test(nomeEstab)) {
      semMatch.push(nota.id);
      continue;
    }

    const { error } = await sb
      .from("notas_fiscais")
      .update({ emitente_nome: nomeEstab })
      .eq("id", nota.id);

    if (!error) atualizadas.push(`${nota.id} → ${nomeEstab}`);
    else semMatch.push(`${nota.id} (erro: ${error.message})`);
  }

  return NextResponse.json({
    ok: true,
    total_notas_sem_emitente: notas.length,
    atualizadas: atualizadas.length,
    sem_match: semMatch.length,
    detalhes: atualizadas,
  });
}
