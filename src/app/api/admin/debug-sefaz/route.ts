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
    // Lista todas as notas para diagnóstico
    const { data: todasNotas } = await getSupabase()
      .from("notas_fiscais")
      .select("id, chave_acesso, url_consulta, emitente_nome, criado_em")
      .order("criado_em", { ascending: false })
      .limit(20);

    const resumo = (todasNotas ?? []).map((n) => ({
      id: n.id,
      chave: (n.chave_acesso as string)?.slice(0, 10) + "...",
      tem_url: !!(n.url_consulta),
      emitente: n.emitente_nome ?? null,
      criado_em: n.criado_em,
    }));

    const comUrl = (todasNotas ?? []).find((n) => n.url_consulta);
    if (!comUrl) {
      return NextResponse.json({
        erro: "Nenhuma nota com url_consulta encontrada.",
        notas: resumo,
      });
    }

    url = comUrl.url_consulta as string;
    console.log("[debug-sefaz] usando nota:", comUrl.id, "| emitente atual:", comUrl.emitente_nome);
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
