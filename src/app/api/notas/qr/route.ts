import { NextRequest, NextResponse } from "next/server";
import { registrarNotaDeQr } from "@/lib/notas-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Recebe o texto do QR Code já decodificado no navegador (BarcodeDetector). */
export async function POST(req: NextRequest) {
  try {
    const corpo = (await req.json()) as { conteudo?: string };
    if (!corpo.conteudo?.trim()) {
      return NextResponse.json({ erro: "Envie o conteúdo do QR Code no campo 'conteudo'." }, { status: 400 });
    }
    const r = await registrarNotaDeQr(corpo.conteudo.trim());
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    return NextResponse.json({
      ok: true,
      jaExistia: r.jaExistia,
      nota: r.nota,
      dados: r.dados,
      itensImportados: r.itensImportados ?? 0,
      valorTotal: r.valorTotal ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
