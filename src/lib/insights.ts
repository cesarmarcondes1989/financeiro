import type { Transacao } from "./types";

export interface ResumoMensal {
  mes: string; // YYYY-MM
  total: number;
}

export interface ResumoCategoria {
  categoria: string;
  total: number;
  percentual: number;
}

export interface Insight {
  tipo: "alerta" | "sugestao" | "positivo";
  titulo: string;
  detalhe: string;
  economiaEstimada?: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function resumoPorMes(transacoes: Transacao[]): ResumoMensal[] {
  const mapa = new Map<string, number>();
  for (const t of transacoes) {
    const mes = t.data.slice(0, 7);
    mapa.set(mes, (mapa.get(mes) ?? 0) + Number(t.valor));
  }
  return [...mapa.entries()]
    .map(([mes, total]) => ({ mes, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

export function resumoPorCategoria(transacoes: Transacao[]): ResumoCategoria[] {
  const mapa = new Map<string, number>();
  let total = 0;
  for (const t of transacoes) {
    mapa.set(t.categoria, (mapa.get(t.categoria) ?? 0) + Number(t.valor));
    total += Number(t.valor);
  }
  return [...mapa.entries()]
    .map(([categoria, v]) => ({
      categoria,
      total: Math.round(v * 100) / 100,
      percentual: total > 0 ? Math.round((v / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

interface GastoEstabelecimento {
  descricao: string;
  total: number;
  vezes: number;
}

export function topEstabelecimentos(transacoes: Transacao[], n = 8): GastoEstabelecimento[] {
  const mapa = new Map<string, { total: number; vezes: number }>();
  for (const t of transacoes) {
    const chave = t.descricao.toLowerCase().replace(/\s+\d+\/\d+$/, "").trim();
    const atual = mapa.get(chave) ?? { total: 0, vezes: 0 };
    atual.total += Number(t.valor);
    atual.vezes += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([descricao, v]) => ({ descricao, total: Math.round(v.total * 100) / 100, vezes: v.vezes }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

/** Detecta possíveis assinaturas: mesmo estabelecimento, valor parecido, meses distintos. */
export function detectarAssinaturas(transacoes: Transacao[]): GastoEstabelecimento[] {
  const porDesc = new Map<string, Transacao[]>();
  for (const t of transacoes) {
    const chave = t.descricao.toLowerCase().trim();
    if (!porDesc.has(chave)) porDesc.set(chave, []);
    porDesc.get(chave)!.push(t);
  }
  const assinaturas: GastoEstabelecimento[] = [];
  for (const [descricao, ts] of porDesc) {
    const meses = new Set(ts.map((t) => t.data.slice(0, 7)));
    if (meses.size < 2) continue;
    const valores = ts.map((t) => Number(t.valor));
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const variacao = Math.max(...valores) - Math.min(...valores);
    if (media > 0 && variacao / media < 0.15) {
      assinaturas.push({
        descricao,
        total: Math.round(media * 100) / 100,
        vezes: ts.length,
      });
    }
  }
  return assinaturas.sort((a, b) => b.total - a.total);
}

/** Gera sugestões de economia baseadas em regras sobre o histórico. */
export function gerarInsights(transacoes: Transacao[]): Insight[] {
  const insights: Insight[] = [];
  if (!transacoes.length) return insights;

  const meses = resumoPorMes(transacoes);
  const categorias = resumoPorCategoria(transacoes);

  // 1) Crescimento mês a mês
  if (meses.length >= 2) {
    const atual = meses[meses.length - 1];
    const anterior = meses[meses.length - 2];
    if (anterior.total > 0) {
      const variacao = ((atual.total - anterior.total) / anterior.total) * 100;
      if (variacao > 10) {
        insights.push({
          tipo: "alerta",
          titulo: `Gastos subiram ${variacao.toFixed(0)}% em ${atual.mes}`,
          detalhe: `Você gastou ${fmt(atual.total)} contra ${fmt(anterior.total)} no mês anterior. Revise as categorias que mais cresceram.`,
        });
      } else if (variacao < -5) {
        insights.push({
          tipo: "positivo",
          titulo: `Gastos caíram ${Math.abs(variacao).toFixed(0)}% em ${atual.mes}`,
          detalhe: `Ótimo trabalho! Você economizou ${fmt(anterior.total - atual.total)} em relação ao mês anterior.`,
        });
      }
    }
  }

  // 2) Categoria dominante
  const top = categorias[0];
  if (top && top.percentual > 35 && top.categoria !== "Outros") {
    insights.push({
      tipo: "sugestao",
      titulo: `${top.categoria} concentra ${top.percentual}% dos seus gastos`,
      detalhe: `Total de ${fmt(top.total)}. Reduzir 15% nessa categoria economizaria ${fmt(top.total * 0.15)}.`,
      economiaEstimada: Math.round(top.total * 0.15 * 100) / 100,
    });
  }

  // 3) Assinaturas recorrentes
  const assinaturas = detectarAssinaturas(transacoes);
  if (assinaturas.length >= 3) {
    const totalMensal = assinaturas.reduce((a, s) => a + s.total, 0);
    insights.push({
      tipo: "sugestao",
      titulo: `${assinaturas.length} assinaturas recorrentes detectadas (~${fmt(totalMensal)}/mês)`,
      detalhe: `Ex.: ${assinaturas.slice(0, 3).map((s) => s.descricao).join(", ")}. Cancele as que você usa pouco — cada uma a menos é economia garantida todo mês.`,
      economiaEstimada: Math.round(totalMensal * 0.3 * 100) / 100,
    });
  }

  // 4) Muitas compras pequenas de alimentação/delivery
  const alimentacao = transacoes.filter((t) => t.categoria === "Alimentação");
  if (alimentacao.length >= 8) {
    const totalAlim = alimentacao.reduce((a, t) => a + Number(t.valor), 0);
    const ticket = totalAlim / alimentacao.length;
    insights.push({
      tipo: "sugestao",
      titulo: `${alimentacao.length} compras de alimentação fora de casa (${fmt(totalAlim)})`,
      detalhe: `Ticket médio de ${fmt(ticket)}. Substituir 1 em cada 4 pedidos por comida em casa pouparia cerca de ${fmt(totalAlim * 0.25)}.`,
      economiaEstimada: Math.round(totalAlim * 0.25 * 100) / 100,
    });
  }

  // 5) Parcelamentos ativos
  const parceladas = transacoes.filter((t) => t.parcela);
  if (parceladas.length >= 5) {
    const totalParc = parceladas.reduce((a, t) => a + Number(t.valor), 0);
    insights.push({
      tipo: "alerta",
      titulo: `${parceladas.length} lançamentos parcelados na fatura`,
      detalhe: `Parcelas somam ${fmt(totalParc)}. Parcelamentos comprometem as próximas faturas — evite novos até quitar os atuais.`,
    });
  }

  return insights;
}
