import { NextRequest, NextResponse } from "next/server";
import { extrairDadosDoHtml } from "@/lib/sefaz";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Testa a extração de dados de um QR Code da SEFAZ.
 * GET /api/admin/debug-sefaz?url=https://...
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ erro: "Passe ?url=URL_DO_QR_CODE" }, { status: 400 });
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
