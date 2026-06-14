import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase";
import { listarTransacoes } from "@/lib/dados";
import { gerarInsights, resumoPorCategoria, resumoPorMes } from "@/lib/insights";
import { CORES_CATEGORIAS, ICONES_CATEGORIAS } from "@/lib/categorize";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Dashboard() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Dashboard</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const transacoes = await listarTransacoes();
  const meses = resumoPorMes(transacoes);
  const categorias = resumoPorCategoria(transacoes);
  const insights = gerarInsights(transacoes);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const gastoMesAtual = meses.find((m) => m.mes === mesAtual)?.total ?? 0;
  const mesAnterior = meses.filter((m) => m.mes < mesAtual).at(-1);
  const totalGeral = transacoes.reduce((a, t) => a + t.valor, 0);
  const recentes = transacoes.slice(0, 5);

  const variacao =
    mesAnterior && mesAnterior.total > 0
      ? ((gastoMesAtual - mesAnterior.total) / mesAnterior.total) * 100
      : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ marginBottom: 0 }}>💰 <span style={{ color: "var(--primary-hover)" }}>Financeiro</span></h1>
        <span style={{ fontSize: 12, color: "var(--text-dim)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 99, padding: "4px 10px" }}>
          {new Date().toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "")}
        </span>
      </div>

      {!transacoes.length ? (
        <div className="card">
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Comece agora 🚀</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 14 }}>
            Escaneie o QR Code de um cupom fiscal ou importe sua fatura do banco.
          </p>
          <Link href="/notas/scanner" className="btn" style={{ marginBottom: 8 }}>📷 Abrir scanner</Link>
          <Link href="/upload" className="btn btn-secundario">Importar fatura</Link>
        </div>
      ) : (
        <>
          {/* KPI principal */}
          <div className="card">
            <h2>Gasto no mês atual</h2>
            <div className="kpi">{fmt(gastoMesAtual)}</div>
            {variacao !== null && (
              <div className="kpi-sub" style={{ color: variacao < 0 ? "var(--green)" : "var(--red)" }}>
                {variacao < 0 ? "↓" : "↑"} {Math.abs(variacao).toFixed(0)}% vs mês anterior{" "}
                <span style={{ color: "var(--text-dim)" }}>({fmt(mesAnterior!.total)})</span>
              </div>
            )}
            {variacao === null && mesAnterior && (
              <div className="kpi-sub">mês anterior: {fmt(mesAnterior.total)}</div>
            )}
          </div>

          {/* Grid 2 */}
          <div className="grid2">
            <div className="card">
              <h2>Total geral</h2>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(totalGeral)}</div>
              <div className="kpi-sub">{transacoes.length} transações</div>
            </div>
            <div className="card">
              <h2>Top categoria</h2>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{categorias[0]?.categoria ?? "—"}</div>
              <div className="kpi-sub">
                {categorias[0] ? `${categorias[0].percentual}% do total` : "sem dados"}
              </div>
            </div>
          </div>

          {/* Insights */}
          {insights.slice(0, 2).map((i, idx) => (
            <div key={idx} className={`insight ${i.tipo}`}>
              <strong>{i.titulo}</strong>
              <p>{i.detalhe}</p>
              {i.economiaEstimada ? (
                <span className="economia">Economia potencial: {fmt(i.economiaEstimada)}</span>
              ) : null}
            </div>
          ))}

          {/* Barras por categoria */}
          {categorias.length > 0 && (
            <div className="card">
              <h2 style={{ marginBottom: 14 }}>Por categoria</h2>
              {categorias.slice(0, 6).map((c) => (
                <div className="cat-barra" key={c.categoria}>
                  <div className="cat-row">
                    <span>{ICONES_CATEGORIAS[c.categoria] ?? "💳"} {c.categoria}</span>
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                      {fmt(c.total)} · {c.percentual}%
                    </span>
                  </div>
                  <div className="cat-track">
                    <div
                      className="cat-fill"
                      style={{
                        width: `${c.percentual}%`,
                        background: CORES_CATEGORIAS[c.categoria] ?? "#64748b",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transações recentes */}
          {recentes.length > 0 && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ marginBottom: 0 }}>Recentes</h2>
                <Link href="/transacoes" style={{ color: "var(--primary-hover)", fontSize: 13 }}>
                  Ver todas →
                </Link>
              </div>
              {recentes.map((t) => (
                <div className="item-transacao" key={t.id}>
                  <div
                    className="item-icone"
                    style={{ background: `${CORES_CATEGORIAS[t.categoria] ?? "#64748b"}22` }}
                  >
                    {ICONES_CATEGORIAS[t.categoria] ?? "💳"}
                  </div>
                  <div className="item-info">
                    <div className="item-nome">{t.descricao}</div>
                    <div className="item-cat">
                      {t.categoria} · {t.data.split("-").reverse().join("/")}
                    </div>
                  </div>
                  <div className="item-valor">−{fmt(t.valor)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
