import { NextRequest, NextResponse } from "next/server";
import { extrairDadosDoHtml } from "@/lib/sefaz";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Testa a extração de dados da SEFAZ.
 * GET /api/admin/debug-sefaz         → usa a nota mais recente com url_consulta
 * GET /api/admin/debug-sefaz?url=... → usa a URL informada
 */
export async function GET(req: NextRequest) {
  let url = req.nextUrl.searchParams.get("url");

  if (!url) {
    // Busca a nota mais recente que tem url_consulta
    const { data } = await getSupabase()
      .from("notas_fiscais")
      .select("id, chave_acesso, url_consulta, emitente_nome, created_at")
      .not("url_consulta", "is", null)
      .neq("url_consulta", "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.url_consulta) {
      return NextResponse.json({ erro: "Nenhuma nota com url_consulta encontrada no banco." });
    }

    url = data.url_consulta as string;
    console.log("[debug-sefaz] usando nota:", data.id, "| emitente atual:", data.emitente_nome);
  }

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    const status = resp.status;
    const finalUrl = resp.url;

    if (!resp.ok) {
      return NextResponse.json({ status, finalUrl, erro: "SEFAZ retornou status não-OK" });
    }

    const html = await resp.text();
    const dados = extrairDadosDoHtml(html);

    return NextResponse.json({
      status,
      finalUrl,
      htmlLength: html.length,
      // Trecho do HTML para ver a estrutura do emitente
      htmlInicio: html.slice(0, 2000),
      // O que o parser conseguiu extrair
      extraido: {
        emitenteNome: dados?.emitenteNome ?? null,
        emitenteCnpj: dados?.emitenteCnpj ?? null,
        municipio: dados?.municipio ?? null,
        valorTotal: dados?.valorTotal ?? null,
        itens: dados?.itens.length ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
