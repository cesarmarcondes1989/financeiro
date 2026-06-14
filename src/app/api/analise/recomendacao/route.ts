import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listarTransacoesHistorico, listarItensComEstabelecimento } from "@/lib/dados";
import { supabaseConfigurado } from "@/lib/supabase";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function nomeMes(yyyyMM: string) {
  const [ano, mo] = yyyyMM.split("-");
  return new Date(Number(ano), Number(mo) - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export async function POST() {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ erro: "Configure ANTHROPIC_API_KEY no Vercel para usar esta função." }, { status: 503 });
  }

  const [historico, itensEstab] = await Promise.all([
    listarTransacoesHistorico(3),
    listarItensComEstabelecimento(),
  ]);

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mesAnt = hoje.getMonth() === 0
    ? `${hoje.getFullYear() - 1}-12`
    : `${hoje.getFullYear()}-${String(hoje.getMonth()).padStart(2, "0")}`;

  // Agrupa por mês e categoria
  const porMesCat: Record<string, Record<string, number>> = {};
  for (const t of historico) {
    const mes = t.data.slice(0, 7);
    if (!porMesCat[mes]) porMesCat[mes] = {};
    porMesCat[mes][t.categoria] = (porMesCat[mes][t.categoria] ?? 0) + t.valor;
  }

  const catAtual = porMesCat[mesAtual] ?? {};
  const catAnt = porMesCat[mesAnt] ?? {};
  const totalAtual = Object.values(catAtual).reduce((s, v) => s + v, 0);
  const totalAnt = Object.values(catAnt).reduce((s, v) => s + v, 0);

  const linhasCat = Object.entries(catAtual)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, v]) => {
      const ant = catAnt[cat] ?? 0;
      const delta = ant > 0 ? Math.round((v - ant) / ant * 100) : null;
      const tendencia = delta != null ? (delta > 0 ? ` ▲${delta}%` : ` ▼${Math.abs(delta)}%`) : "";
      return `- ${cat}: ${fmt(v)}${tendencia}`;
    })
    .join("\n");

  // Top produtos NFC-e
  const porProduto: Record<string, { total: number; vezes: number }> = {};
  for (const item of itensEstab) {
    const k = item.descricao.trim().toUpperCase();
    if (!porProduto[k]) porProduto[k] = { total: 0, vezes: 0 };
    porProduto[k].total += item.valor_total;
    porProduto[k].vezes += 1;
  }
  const linhasProdutos = Object.entries(porProduto)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([n, d]) => `- ${n}: ${fmt(d.total)}, comprado ${d.vezes}x`)
    .join("\n");

  // Preços por loja
  const porProdEstab: Record<string, Record<string, { total: number; count: number }>> = {};
  for (const item of itensEstab) {
    if (!item.valor_unitario || !item.emitente_nome) continue;
    const k = item.descricao.trim().toUpperCase();
    const e = item.emitente_nome.trim();
    if (!porProdEstab[k]) porProdEstab[k] = {};
    if (!porProdEstab[k][e]) porProdEstab[k][e] = { total: 0, count: 0 };
    porProdEstab[k][e].total += item.valor_unitario;
    porProdEstab[k][e].count += 1;
  }
  const economias: string[] = [];
  for (const [produto, estabs] of Object.entries(porProdEstab)) {
    const precos = Object.entries(estabs)
      .map(([e, d]) => ({ e, preco: d.total / d.count }))
      .sort((a, b) => a.preco - b.preco);
    if (precos.length < 2) continue;
    const min = precos[0];
    const max = precos[precos.length - 1];
    const pct = Math.round((max.preco - min.preco) / max.preco * 100);
    if (pct >= 5) economias.push(`- ${produto}: ${min.e} ${fmt(min.preco)} vs ${max.e} ${fmt(max.preco)} (${pct}% mais barato no primeiro)`);
  }
  const linhasEconomia = economias.slice(0, 5).join("\n");

  // Monta prompt
  const variacaoTotal = totalAnt > 0
    ? `${totalAtual > totalAnt ? "▲" : "▼"} ${fmt(Math.abs(totalAtual - totalAnt))} vs ${nomeMes(mesAnt)}`
    : "";

  const prompt = `Dados reais dos meus gastos:

MÊS ATUAL — ${nomeMes(mesAtual)}: ${fmt(totalAtual)} ${variacaoTotal}
${linhasCat || "(sem transações este mês)"}

${totalAnt > 0 ? `MÊS ANTERIOR — ${nomeMes(mesAnt)}: ${fmt(totalAnt)}` : ""}

${linhasProdutos ? `PRODUTOS MAIS COMPRADOS (nos cupons fiscais):\n${linhasProdutos}` : ""}

${linhasEconomia ? `MESMO PRODUTO, PREÇOS DIFERENTES:\n${linhasEconomia}` : ""}

Me dê uma análise em linguagem natural, como um amigo que entende de finanças me contando como estão meus gastos. Seja direto e use os valores reais. No final inclua exatamente 3 ações práticas numeradas para economizar esse mês. Sem markdown, só texto corrido. Máximo 280 palavras.`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 550,
      system: "Você é um consultor financeiro pessoal amigável. Fala em português brasileiro, de forma natural e direta, sem usar markdown ou asteriscos.",
      messages: [{ role: "user", content: prompt }],
    });

    const recomendacao = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    return NextResponse.json({ recomendacao });
  } catch (e) {
    console.error("[recomendacao]", e);
    return NextResponse.json({ erro: "Falha ao consultar IA." }, { status: 500 });
  }
}
