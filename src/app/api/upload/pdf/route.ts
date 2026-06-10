import { NextRequest, NextResponse } from "next/server";
import { parsePdf, PdfSemTextoError } from "@/lib/parsers/pdf";
import { inserirTransacoes, registrarEvento } from "@/lib/dados";
import { PONTOS } from "@/lib/gamification";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ erro: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const transacoes = await parsePdf(buffer);
    if (!transacoes.length) {
      return NextResponse.json(
        { erro: "Nenhuma transação reconhecida no PDF. O formato da fatura pode não ser suportado — tente exportar como Excel/CSV." },
        { status: 422 }
      );
    }

    const inseridas = await inserirTransacoes(transacoes, "pdf");
    if (inseridas > 0) {
      await registrarEvento(
        "importacao",
        PONTOS.IMPORTACAO + inseridas * PONTOS.TRANSACAO_IMPORTADA,
        `Importação de PDF: ${inseridas} transações`
      );
    }

    return NextResponse.json({
      ok: true,
      encontradas: transacoes.length,
      inseridas,
      duplicadas: transacoes.length - inseridas,
    });
  } catch (e) {
    if (e instanceof PdfSemTextoError) {
      return NextResponse.json({ erro: e.message }, { status: 422 });
    }
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
