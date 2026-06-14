import { NextResponse } from "next/server";
import { listarItensComEstabelecimento, listarTransacoesHistorico } from "@/lib/dados";
import { supabaseConfigurado } from "@/lib/supabase";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function GET() {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const [historico, itensEstab] = await Promise.all([
    listarTransacoesHistorico(6),
    listarItensComEstabelecimento(),
  ]);

  // Mostra itens RAW relacionados ao Red Bull para diagnóstico
  const redBullRaw = itensEstab.filter((i) =>
    i.descricao.toUpperCase().includes("RED BULL")
  );

  // Todos os produtos
  const todosProd: Record<string, { total: number; vezes: number }> = {};
  for (const item of itensEstab) {
    const prod = item.descricao.trim().toUpperCase();
    if (!todosProd[prod]) todosProd[prod] = { total: 0, vezes: 0 };
    todosProd[prod].total += item.valor_total;
    todosProd[prod].vezes += 1;
  }

  // Preços por loja
  const porProdEstab: Record<string, { loja: string; soma: number; vezes: number }[]> = {};
  for (const item of itensEstab) {
    if (!item.emitente_nome) continue;
    const precoUnit =
      item.valor_unitario ??
      (item.quantidade > 0 ? item.valor_total / item.quantidade : item.valor_total);
    if (!precoUnit || precoUnit <= 0) continue;
    const prod = item.descricao.trim().toUpperCase();
    const loja = item.emitente_nome.trim();
    if (!porProdEstab[prod]) porProdEstab[prod] = [];
    const existente = porProdEstab[prod].find((x) => x.loja === loja);
    if (existente) {
      existente.soma += precoUnit;
      existente.vezes += 1;
    } else {
      porProdEstab[prod].push({ loja, soma: precoUnit, vezes: 1 });
    }
  }

  return NextResponse.json({
    totais: {
      transacoes: historico.length,
      itens: itensEstab.length,
      itens_com_emitente: itensEstab.filter((i) => i.emitente_nome).length,
      itens_sem_emitente: itensEstab.filter((i) => !i.emitente_nome).length,
    },
    red_bull_raw: redBullRaw.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      valor_total: i.valor_total,
      emitente_nome: i.emitente_nome,
      unitario_calculado:
        i.valor_unitario ?? (i.quantidade > 0 ? i.valor_total / i.quantidade : null),
    })),
    red_bull_agregado: Object.entries(todosProd)
      .filter(([k]) => k.includes("RED BULL"))
      .map(([prod, d]) => ({
        produto: prod,
        total_gasto: fmt(d.total),
        vezes_aparece: d.vezes,
        media_por_ocorrencia: fmt(d.total / d.vezes),
      })),
    red_bull_por_loja: Object.entries(porProdEstab)
      .filter(([k]) => k.includes("RED BULL"))
      .map(([prod, lojas]) => ({
        produto: prod,
        lojas: lojas.map((l) => ({
          loja: l.loja,
          preco_medio: fmt(l.soma / l.vezes),
          amostras: l.vezes,
        })),
      })),
  });
}
