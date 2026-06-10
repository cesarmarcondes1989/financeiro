import { NextRequest, NextResponse } from "next/server";
import { registrarNotaPorChave } from "@/lib/notas-service";

export const runtime = "nodejs";

/** Registra uma nota pela chave de acesso digitada (fallback do QR Code). */
export async function POST(req: NextRequest) {
  try {
    const corpo = (await req.json()) as {
      chave?: string;
      valorTotal?: number;
      dataEmissao?: string;
    };
    if (!corpo.chave?.trim()) {
      return NextResponse.json({ erro: "Informe a chave de acesso." }, { status: 400 });
    }
    const r = await registrarNotaPorChave(corpo.chave, {
      valorTotal: corpo.valorTotal,
      dataEmissao: corpo.dataEmissao,
    });
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: r.status });
    return NextResponse.json({ ok: true, jaExistia: r.jaExistia, nota: r.nota, dados: r.dados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
