import { NextRequest, NextResponse } from "next/server";
import { atualizarNota, excluirNota } from "@/lib/dados";
import type { NotaFiscal } from "@/lib/types";

export const runtime = "nodejs";

/** Exclui a nota, seus itens e o gasto lançado a partir dela. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await excluirNota(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

/** Edita dados da nota (estabelecimento, data de emissão, valor total). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const corpo = (await req.json()) as {
      emitente_nome?: string;
      data_emissao?: string;
      valor_total?: number;
    };

    const campos: Partial<NotaFiscal> = {};
    if (typeof corpo.emitente_nome === "string") {
      campos.emitente_nome = corpo.emitente_nome.trim() || null;
    }
    if (corpo.data_emissao) {
      if (isNaN(Date.parse(corpo.data_emissao))) {
        return NextResponse.json({ erro: "Data de emissão inválida." }, { status: 400 });
      }
      campos.data_emissao = new Date(corpo.data_emissao).toISOString();
    }
    if (corpo.valor_total !== undefined) {
      if (typeof corpo.valor_total !== "number" || !(corpo.valor_total > 0)) {
        return NextResponse.json({ erro: "Valor total inválido." }, { status: 400 });
      }
      campos.valor_total = Math.round(corpo.valor_total * 100) / 100;
    }
    if (!Object.keys(campos).length) {
      return NextResponse.json({ erro: "Nenhum campo para atualizar." }, { status: 400 });
    }

    await atualizarNota(id, campos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
