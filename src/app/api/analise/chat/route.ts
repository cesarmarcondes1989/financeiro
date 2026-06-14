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

  // Preço médio de cada produto por loja
  const porProdEstab: Record<string, { loja: string; soma: number; vezes: number }[]> = {};
  for (const item of itensEstab) {
    if (!item.emitente_nome || !item.valor_unitario) continue;
    const prod = item.descricao.trim().toUpperCase();
    const loja = item.emitente_nome.trim();
    if (!porProdEstab[prod]) porProdEstab[prod] = [];
    const existente = porProdEstab[prod].find((x) => x.loja === loja);
    if (existente) {
      existente.soma += item.valor_unitario;
      existente.vezes += 1;
    } else {
      porProdEstab[prod].push({ loja, soma: item.valor_unitario, vezes: 1 });
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

  const systemPrompt = `Você é um assistente financeiro pessoal. Responda perguntas sobre os gastos reais do usuário de forma direta e objetiva. Cite lojas, produtos e valores quando relevante. Português brasileiro informal. Sem markdown nem asteriscos.

=== GASTOS POR MÊS E CATEGORIA ===
${resumoTransacoes || "Sem dados"}

=== PRODUTOS E PREÇOS POR LOJA (preço médio unitário) ===
${linhasPrecos || "Sem dados de preços"}`;

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
