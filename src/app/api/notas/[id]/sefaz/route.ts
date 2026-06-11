import { NextRequest, NextResponse } from "next/server";
import { buscarNota } from "@/lib/dados";
import { importarDaSefaz } from "@/lib/notas-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Busca emitente, valor total e itens da nota no portal da SEFAZ. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const resultado = await buscarNota(id);
    if (!resultado) {
      return NextResponse.json({ erro: "Nota não encontrada." }, { status: 404 });
    }
    const r = await importarDaSefaz(resultado.nota);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    return NextResponse.json({
      ok: true,
      itensImportados: r.itensImportados ?? 0,
      valorTotal: r.valorTotal ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
