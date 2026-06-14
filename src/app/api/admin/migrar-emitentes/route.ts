import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { atualizarNota } from "@/lib/dados";
import { consultarNfceNaSefaz } from "@/lib/sefaz";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutos

/**
 * Migração de legado: percorre todas as notas sem emitente_nome que têm
 * url_consulta e tenta preencher o emitente consultando a SEFAZ.
 *
 * POST /api/admin/migrar-emitentes
 * Header: x-admin-secret: <ADMIN_SECRET env var>
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const sb = getSupabase();

  // Busca todas as notas sem emitente mas com URL para consulta
  const { data: notas, error } = await sb
    .from("notas_fiscais")
    .select("id, url_consulta, emitente_nome, chave_acesso")
    .is("emitente_nome", null)
    .not("url_consulta", "is", null)
    .neq("url_consulta", "")
    .limit(200);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  if (!notas?.length) {
    return NextResponse.json({ ok: true, mensagem: "Nenhuma nota pendente.", processadas: 0 });
  }

  const resultados: Array<{ id: string; chave: string; status: string; emitente?: string }> = [];

  for (const nota of notas) {
    const id = nota.id as string;
    const chave = (nota.chave_acesso as string ?? "").slice(0, 8) + "...";

    try {
      const sefaz = await consultarNfceNaSefaz(nota.url_consulta as string);

      if (!sefaz?.emitenteNome) {
        resultados.push({ id, chave, status: "sem_emitente_no_html" });
        continue;
      }

      await atualizarNota(id, {
        emitente_nome: sefaz.emitenteNome,
        ...(sefaz.emitenteCnpj ? { emitente_cnpj: sefaz.emitenteCnpj } : {}),
        ...(sefaz.municipio ? { municipio: sefaz.municipio } : {}),
        ...(sefaz.dataEmissao ? { data_emissao: sefaz.dataEmissao } : {}),
        ...(sefaz.valorTotal ? { valor_total: sefaz.valorTotal } : {}),
      });

      resultados.push({ id, chave, status: "ok", emitente: sefaz.emitenteNome });
    } catch (e) {
      resultados.push({ id, chave, status: "erro", emitente: e instanceof Error ? e.message : String(e) });
    }

    // Pausa entre requisições para não sobrecarregar a SEFAZ
    await new Promise((r) => setTimeout(r, 800));
  }

  const ok = resultados.filter((r) => r.status === "ok").length;
  const semEmitente = resultados.filter((r) => r.status === "sem_emitente_no_html").length;
  const erros = resultados.filter((r) => r.status === "erro").length;

  return NextResponse.json({
    ok: true,
    total: notas.length,
    atualizadas: ok,
    sem_emitente_no_html: semEmitente,
    erros,
    detalhes: resultados,
  });
}
