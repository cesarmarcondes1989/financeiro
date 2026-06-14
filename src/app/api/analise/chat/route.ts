import { NextResponse } from "next/server";
import OpenAI from "openai";
import { listarItensComEstabelecimento, listarTransacoesHistorico } from "@/lib/dados";
import { supabaseConfigurado } from "@/lib/supabase";

type Mensagem = { role: "user" | "assistant"; content: string };

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function POST(req: Request) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ erro: "Configure OPENAI_API_KEY no Vercel." }, { status: 503 });
  }

  const { messages }: { messages: Mensagem[] } = await req.json();

  const [historico, itensEstab] = await Promise.all([
    listarTransacoesHistorico(6),
    listarItensComEstabelecimento(),
  ]);

  // Resumo de gastos por mês e categoria
  const porMesCat: Record<string, Record<string, number>> = {};
  for (const t of historico) {
    const mes = t.data.slice(0, 7);
    if (!porMesCat[mes]) porMesCat[mes] = {};
    porMesCat[mes][t.categoria] = (porMesCat[mes][t.categoria] ?? 0) + t.valor;
  }
  const resumoTransacoes = Object.entries(porMesCat)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4)
    .map(([mes, cats]) => {
      const total = Object.values(cats).reduce((s, v) => s + v, 0);
      const linhas = Object.entries(cats)
        .sort(([, a], [, b]) => b - a)
        .map(([cat, v]) => `  - ${cat}: ${fmt(v)}`)
        .join("\n");
      return `${mes} (total: ${fmt(total)})\n${linhas}`;
    })
    .join("\n\n");

  // Todos os produtos comprados (com ou sem loja)
  const todosProd: Record<string, { total: number; vezes: number }> = {};
  for (const item of itensEstab) {
    const prod = item.descricao.trim().toUpperCase();
    if (!todosProd[prod]) todosProd[prod] = { total: 0, vezes: 0 };
    todosProd[prod].total += item.valor_total;
    todosProd[prod].vezes += 1;
  }
  const linhasTodosProd = Object.entries(todosProd)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 200)
    .map(([prod, d]) => `${prod}: ${fmt(d.total)} (${d.vezes}x comprado)`)
    .join("\n");

  // Preço por produto e loja (apenas itens com nome de loja)
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
  const linhasPrecos = Object.entries(porProdEstab)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 300)
    .map(([prod, lojas]) => {
      const sorted = lojas
        .map((l) => ({ loja: l.loja, preco: l.soma / l.vezes }))
        .sort((a, b) => a.preco - b.preco);
      return `${prod}: ${sorted.map((l) => `${l.loja} ${fmt(l.preco)}`).join(" | ")}`;
    })
    .join("\n");

  const systemPrompt = `Você é um assistente financeiro pessoal. Responda perguntas sobre os gastos REAIS do usuário. Use os dados abaixo para responder com precisão. Se o produto estiver na lista, diga o valor e a loja. Fale em português brasileiro informal. Sem markdown nem asteriscos.

=== GASTOS POR MÊS E CATEGORIA ===
${resumoTransacoes || "Sem dados"}

=== TODOS OS PRODUTOS COMPRADOS ===
${linhasTodosProd || "Sem dados"}

=== PREÇOS POR PRODUTO E LOJA (preço médio unitário) ===
${linhasPrecos || "Sem dados de preços por loja"}`;

  try {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });
    const resposta = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ resposta });
  } catch (e) {
    console.error("[chat]", e);
    return NextResponse.json({ erro: "Falha ao consultar IA." }, { status: 500 });
  }
}
