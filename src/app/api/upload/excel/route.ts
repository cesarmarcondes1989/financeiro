import { NextRequest, NextResponse } from "next/server";
import { parseExcel } from "@/lib/parsers/excel";
import { inserirTransacoes, registrarEvento } from "@/lib/dados";
import { PONTOS } from "@/lib/gamification";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ erro: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const transacoes = parseExcel(buffer);
    if (!transacoes.length) {
      return NextResponse.json(
        { erro: "Nenhuma transação encontrada. Verifique se a planilha tem colunas de data, descrição e valor." },
        { status: 422 }
      );
    }

    const inseridas = await inserirTransacoes(transacoes, "excel");
    if (inseridas > 0) {
      await registrarEvento(
        "importacao",
        PONTOS.IMPORTACAO + inseridas * PONTOS.TRANSACAO_IMPORTADA,
        `Importação de Excel: ${inseridas} transações`
      );
    }

    return NextResponse.json({
      ok: true,
      encontradas: transacoes.length,
      inseridas,
      duplicadas: transacoes.length - inseridas,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
