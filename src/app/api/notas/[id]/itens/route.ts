import { NextRequest, NextResponse } from "next/server";
import { inserirItensNota } from "@/lib/dados";
import { categorizar } from "@/lib/categorize";

export const runtime = "nodejs";

interface ItemEntrada {
  descricao?: string;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number;
  categoria?: string;
}

/** Adiciona itens manualmente a uma nota fiscal (conferência do cupom). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const corpo = (await req.json()) as { itens?: ItemEntrada[] };
    const itens = (corpo.itens ?? [])
      .filter((i) => i.descricao && (i.valor_total ?? 0) > 0)
      .map((i) => ({
        descricao: i.descricao!.trim(),
        quantidade: i.quantidade && i.quantidade > 0 ? i.quantidade : 1,
        valor_unitario: i.valor_unitario ?? null,
        valor_total: i.valor_total!,
        categoria: i.categoria?.trim() || categorizar(i.descricao!),
      }));

    if (!itens.length) {
      return NextResponse.json({ erro: "Nenhum item válido (descrição e valor são obrigatórios)." }, { status: 400 });
    }

    const inseridos = await inserirItensNota(id, itens);
    return NextResponse.json({ ok: true, inseridos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
