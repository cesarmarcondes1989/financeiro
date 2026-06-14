import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigurado } from "@/lib/supabase";
import { inserirTransacoes, registrarEvento } from "@/lib/dados";
import { PONTOS } from "@/lib/gamification";

export async function POST(req: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Supabase não configurado." }, { status: 503 });
  }
  try {
    const { descricao, data, valor, categoria } = await req.json();
    if (!descricao?.trim()) {
      return NextResponse.json({ erro: "Descrição obrigatória." }, { status: 400 });
    }
    const v = Number(valor);
    if (!(v > 0)) {
      return NextResponse.json({ erro: "Valor deve ser positivo." }, { status: 400 });
    }
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
    }
    const inseridas = await inserirTransacoes(
      [{ data, descricao: descricao.trim(), valor: v, categoria: categoria || "Outros" }],
      "manual"
    );
    if (inseridas > 0) {
      await registrarEvento("transacao_manual", PONTOS.TRANSACAO_IMPORTADA, descricao.trim());
    }
    return NextResponse.json({ inseridas });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
