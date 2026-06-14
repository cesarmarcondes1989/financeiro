import { Suspense } from "react";
import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase";
import { listarItensComEstabelecimento, listarTransacoesHistorico } from "@/lib/dados";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";
import { CORES_CATEGORIAS, ICONES_CATEGORIAS } from "@/lib/categorize";
import InsightsIA from "./InsightsIA";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function labelMes(yyyyMM: string) {
  const [ano, mo] = yyyyMM.split("-");
  return new Date(Number(ano), Number(mo) - 1)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");
}

export default async function PaginaAnalise() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Análise</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const [historico, itensEstab] = await Promise.all([
    listarTransacoesHistorico(5),
    listarItensComEstabelecimento(),
  ]);

  const semDados = historico.length === 0 && itensEstab.length === 0;

  // ── Comparação mensal ────────────────────────────────
  const porMesCat: Record<string, Record<string, number>> = {};
  for (const t of historico) {
    const mes = t.data.slice(0, 7);
    if (!porMesCat[mes]) porMesCat[mes] = {};
    porMesCat[mes][t.categoria] = (porMesCat[mes][t.categoria] ?? 0) + t.valor;
  }
  const meses = Object.keys(porMesCat).sort().reverse().slice(0, 4);

  const totalPorCat: Record<string, number> = {};
  for (const cats of Object.values(porMesCat)) {
    for (const [k, v] of Object.entries(cats)) {
      totalPorCat[k] = (totalPorCat[k] ?? 0) + v;
    }
  }
  const topCats = Object.entries(totalPorCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat]) => cat);

  // ── Gastos por dia da semana ─────────────────────────
  const gastosDia: Array<{ total: number; vezes: number }> = Array.from({ length: 7 }, () => ({ total: 0, vezes: 0 }));
  for (const t of historico) {
    const d = new Date(t.data + "T12:00:00").getDay();
    gastosDia[d].total += t.valor;
    gastosDia[d].vezes += 1;
  }
  const maxGastoDia = Math.max(...gastosDia.map((d) => d.total));

  // ── Estabelecimentos ─────────────────────────────────
  const porEstab: Record<string, { total: number; visitas: Set<string> }> = {};
  for (const item of itensEstab) {
    if (!item.emitente_nome) continue;
    const e = item.emitente_nome.trim();
    if (!porEstab[e]) porEstab[e] = { total: 0, visitas: new Set() };
    porEstab[e].total += item.valor_total;
    if (item.data_emissao) porEstab[e].visitas.add(item.data_emissao.slice(0, 10));
  }
  const topLojas = Object.entries(porEstab)
    .map(([loja, d]) => ({ loja, total: d.total, visitas: d.visitas.size }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // ── Top produtos NFC-e ───────────────────────────────
  const porProduto: Record<string, { total: number; vezes: number }> = {};
  for (const item of itensEstab) {
    const k = item.descricao.trim().toUpperCase();
    if (!porProduto[k]) porProduto[k] = { total: 0, vezes: 0 };
    porProduto[k].total += item.valor_total;
    porProduto[k].vezes += 1;
  }
  const topProdutos = Object.entries(porProduto)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  // ── Oportunidades de economia (preços por loja) ──────
  type PrecoPorEstab = { total: number; count: number };
  const porProdutoEstab: Record<string, Record<string, PrecoPorEstab>> = {};
  for (const item of itensEstab) {
    if (!item.valor_unitario || !item.emitente_nome) continue;
    const k = item.descricao.trim().toUpperCase();
    const estab = item.emitente_nome.trim();
    if (!porProdutoEstab[k]) porProdutoEstab[k] = {};
    if (!porProdutoEstab[k][estab]) porProdutoEstab[k][estab] = { total: 0, count: 0 };
    porProdutoEstab[k][estab].total += item.valor_unitario;
    porProdutoEstab[k][estab].count += 1;
  }

  type Oportunidade = {
    produto: string;
    maisBarato: { emitente: string; preco: number };
    maisCaro: { emitente: string; preco: number };
    economiaUnit: number;
    economiaPct: number;
  };
  const oportunidades: Oportunidade[] = [];
  for (const [produto, estabs] of Object.entries(porProdutoEstab)) {
    const precos = Object.entries(estabs)
      .map(([e, d]) => ({ emitente: e, preco: d.total / d.count }))
      .sort((a, b) => a.preco - b.preco);
    if (precos.length < 2) continue;
    const maisBarato = precos[0];
    const maisCaro = precos[precos.length - 1];
    const economiaUnit = maisCaro.preco - maisBarato.preco;
    const economiaPct = economiaUnit / maisCaro.preco;
    if (economiaPct >= 0.05) {
      oportunidades.push({ produto, maisBarato, maisCaro, economiaUnit, economiaPct });
    }
  }
  oportunidades.sort((a, b) => b.economiaUnit - a.economiaUnit);
  const topOportunidades = oportunidades.slice(0, 12);

  // ── Texto compacto para a IA ─────────────────────────
  const linhasPrecos = topOportunidades.slice(0, 8).map((op) =>
    `- ${op.produto}: ${op.maisBarato.emitente} ${fmt(op.maisBarato.preco)}/un | ${op.maisCaro.emitente} ${fmt(op.maisCaro.preco)}/un (${Math.round(op.economiaPct * 100)}% mais caro)`
  ).join("\n");

  const linhasDias = gastosDia
    .map((d, i) => ({ dia: DIAS_SEMANA[i], ...d }))
    .filter((d) => d.vezes > 0)
    .sort((a, b) => b.total - a.total)
    .map((d) => `- ${d.dia}: ${fmt(d.total)} total em ${d.vezes} compras`)
    .join("\n");

  const linhasLojas = topLojas
    .map((l) => `- ${l.loja}: ${fmt(l.total)} total, ${l.visitas} visitas`)
    .join("\n");

  const linhasMeses = meses.map((mes, i) => {
    const total = Object.values(porMesCat[mes] ?? {}).reduce((s, v) => s + v, 0);
    const ant = i < meses.length - 1
      ? Object.values(porMesCat[meses[i + 1]] ?? {}).reduce((s, v) => s + v, 0)
      : null;
    const delta = ant != null ? total - ant : null;
    return `- ${labelMes(mes)}: ${fmt(total)}${delta != null ? (delta > 0 ? ` (▲${fmt(delta)})` : ` (▼${fmt(Math.abs(delta))})`) : ""}`;
  }).join("\n");

  const linhasProdutos = topProdutos.slice(0, 8)
    .map(([nome, d]) => `- ${nome}: ${fmt(d.total)} total, comprado ${d.vezes}x`)
    .join("\n");

  const dadosTexto = [
    linhasPrecos && `PREÇOS DO MESMO PRODUTO EM DIFERENTES LOJAS:\n${linhasPrecos}`,
    linhasDias && `GASTOS POR DIA DA SEMANA:\n${linhasDias}`,
    linhasLojas && `ESTABELECIMENTOS MAIS FREQUENTADOS:\n${linhasLojas}`,
    linhasMeses && `EVOLUÇÃO MENSAL:\n${linhasMeses}`,
    linhasProdutos && `PRODUTOS MAIS COMPRADOS:\n${linhasProdutos}`,
  ].filter(Boolean).join("\n\n");

  return (
    <>
      <h1>Análise</h1>

      {semDados ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 12 }}>
            Importe notas fiscais e transações para ver análises detalhadas.
          </p>
          <Link href="/upload" className="btn">➕ Importar dados</Link>
        </div>
      ) : (
        <>
          {/* IA Insights — carrega de forma assíncrona */}
          <Suspense fallback={
            <div className="card" style={{ marginBottom: 12, opacity: 0.6 }}>
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>🤖 Analisando seus dados...</p>
            </div>
          }>
            <InsightsIA dadosTexto={dadosTexto} />
          </Suspense>

          {/* Onde comprar mais barato */}
          {topOportunidades.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginBottom: 6 }}>💡 Onde comprar mais barato</h2>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14 }}>
                Produtos encontrados em 2+ lojas nos seus cupons fiscais.
              </p>
              {topOportunidades.map((op) => (
                <div key={op.produto} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {op.produto}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, background: "rgba(34,197,94,.12)", color: "var(--green)", borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>
                      ✓ {op.maisBarato.emitente}: {fmt(op.maisBarato.preco)}
                    </span>
                    <span style={{ fontSize: 12, background: "rgba(239,68,68,.1)", color: "var(--red)", borderRadius: 6, padding: "3px 8px" }}>
                      {op.maisCaro.emitente}: {fmt(op.maisCaro.preco)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
                    Economia de {fmt(op.economiaUnit)}/un · {Math.round(op.economiaPct * 100)}% mais barato
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gastos por dia da semana */}
          {historico.length > 0 && maxGastoDia > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginBottom: 14 }}>📅 Quando você mais gasta</h2>
              {gastosDia.map((d, i) => {
                if (d.total === 0) return null;
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "var(--text-dim)", minWidth: 32 }}>{DIAS_SEMANA[i]}</span>
                      <span style={{ color: "var(--text-dim)" }}>{d.vezes}x · {fmt(d.total)}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
                      <div style={{
                        height: "100%",
                        width: `${(d.total / maxGastoDia) * 100}%`,
                        background: "var(--primary)",
                        borderRadius: 3,
                        opacity: d.total === maxGastoDia ? 1 : 0.55,
                      }} />
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10 }}>
                Baseado nos últimos 5 meses de transações.
              </p>
            </div>
          )}

          {/* Estabelecimentos */}
          {topLojas.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginBottom: 12 }}>🏪 Estabelecimentos</h2>
              {topLojas.map((l) => (
                <div key={l.loja} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.loja}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{l.visitas} {l.visitas === 1 ? "visita" : "visitas"}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{fmt(l.total)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Comparação mensal */}
          {meses.length > 0 && (
            <div className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ marginBottom: 14 }}>📈 Comparação mensal</h2>
              {meses.map((mes, mesIdx) => {
                const totalMes = Object.values(porMesCat[mes] ?? {}).reduce((s, v) => s + v, 0);
                const totalAnt = mesIdx < meses.length - 1
                  ? Object.values(porMesCat[meses[mesIdx + 1]] ?? {}).reduce((s, v) => s + v, 0)
                  : null;
                const delta = totalAnt != null ? totalMes - totalAnt : null;
                return (
                  <div key={mes} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>{labelMes(mes)}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {delta !== null && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: delta > 0 ? "var(--red)" : "var(--green)" }}>
                            {delta > 0 ? "▲" : "▼"} {fmt(Math.abs(delta))}
                          </span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(totalMes)}</span>
                      </div>
                    </div>
                    {topCats.map((cat) => {
                      const v = porMesCat[mes]?.[cat] ?? 0;
                      if (v === 0) return null;
                      const maxV = Math.max(...meses.map((m) => porMesCat[m]?.[cat] ?? 0));
                      return (
                        <div key={cat} style={{ marginBottom: 7 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: "var(--text-dim)" }}>
                              {ICONES_CATEGORIAS[cat] ?? "💳"} {cat}
                            </span>
                            <span>{fmt(v)}</span>
                          </div>
                          <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                            <div style={{
                              height: "100%",
                              width: `${maxV > 0 ? (v / maxV) * 100 : 0}%`,
                              background: CORES_CATEGORIAS[cat] ?? "var(--primary)",
                              borderRadius: 2,
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Top produtos NFC-e */}
          {topProdutos.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>🛒 Mais comprados (NFC-e)</h2>
              {topProdutos.map(([nome, dados]) => (
                <div key={nome} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nome}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {dados.vezes}× comprado
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {fmt(dados.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
