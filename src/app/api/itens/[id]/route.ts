import { NextRequest, NextResponse } from "next/server";
import { atualizarItem, excluirItem } from "@/lib/dados";

export const runtime = "nodejs";

/** Edita um item da nota (descrição, quantidade, valores, categoria). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const corpo = (await req.json()) as {
      descricao?: string;
      quantidade?: number;
      valor_unitario?: number | null;
      valor_total?: number;
      categoria?: string;
    };

    const campos: Parameters<typeof atualizarItem>[1] = {};
    if (typeof corpo.descricao === "string") {
      if (!corpo.descricao.trim()) {
        return NextResponse.json({ erro: "A descrição não pode ficar vazia." }, { status: 400 });
      }
      campos.descricao = corpo.descricao.trim();
    }
    if (corpo.quantidade !== undefined) {
      if (!(corpo.quantidade > 0)) {
        return NextResponse.json({ erro: "Quantidade inválida." }, { status: 400 });
      }
      campos.quantidade = corpo.quantidade;
    }
    if (corpo.valor_total !== undefined) {
      if (!(corpo.valor_total > 0)) {
        return NextResponse.json({ erro: "Valor total inválido." }, { status: 400 });
      }
      campos.valor_total = Math.round(corpo.valor_total * 100) / 100;
    }
    if (corpo.valor_unitario !== undefined) {
      campos.valor_unitario =
        corpo.valor_unitario === null ? null : Math.round(corpo.valor_unitario * 100) / 100;
    }
    if (typeof corpo.categoria === "string" && corpo.categoria.trim()) {
      campos.categoria = corpo.categoria.trim();
    }
    if (!Object.keys(campos).length) {
      return NextResponse.json({ erro: "Nenhum campo para atualizar." }, { status: 400 });
    }

    await atualizarItem(id, campos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await excluirItem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
