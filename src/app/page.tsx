import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase";
import { listarTransacoes } from "@/lib/dados";
import {
  gerarInsights, resumoPorCategoria, resumoPorMes, topEstabelecimentos,
} from "@/lib/insights";
import { GraficoCategorias, GraficoMensal } from "@/components/Graficos";
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
  const top = topEstabelecimentos(transacoes, 8);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const gastoMesAtual = meses.find((m) => m.mes === mesAtual)?.total ?? 0;
  const mesAnterior = meses.filter((m) => m.mes < mesAtual).at(-1);
  const totalGeral = transacoes.reduce((a, t) => a + t.valor, 0);

  return (
    <>
      <h1>Dashboard</h1>

      {!transacoes.length && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Comece importando seus gastos 🚀</h3>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 14 }}>
            Envie a fatura do cartão (Excel ou PDF) ou fotografe o QR Code de uma
            nota fiscal para começar a análise.
          </p>
          <Link href="/upload" className="btn">Importar agora</Link>
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Gasto no mês atual</h2>
          <div className="kpi">{fmt(gastoMesAtual)}</div>
          {mesAnterior && (
            <div className="kpi-sub">
              mês anterior ({mesAnterior.mes}): {fmt(mesAnterior.total)}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Total registrado</h2>
          <div className="kpi">{fmt(totalGeral)}</div>
          <div className="kpi-sub">{transacoes.length} transações</div>
        </div>
        <div className="card">
          <h2>Maior categoria</h2>
          <div className="kpi">{categorias[0]?.categoria ?? "—"}</div>
          <div className="kpi-sub">
            {categorias[0] ? `${fmt(categorias[0].total)} (${categorias[0].percentual}%)` : "sem dados"}
          </div>
        </div>
      </div>

      {insights.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 18 }}>💡 Análise e sugestões</h1>
          {insights.map((i, idx) => (
            <div key={idx} className={`insight ${i.tipo}`}>
              <strong>{i.titulo}</strong>
              <p>{i.detalhe}</p>
              {i.economiaEstimada ? (
                <span className="economia">
                  Economia potencial: {fmt(i.economiaEstimada)}
                </span>
              ) : null}
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>Gastos por mês</h3>
          <GraficoMensal dados={meses} />
        </div>
        <div className="card">
          <h3>Gastos por categoria</h3>
          <GraficoCategorias dados={categorias} />
        </div>
      </div>

      {top.length > 0 && (
        <div className="card">
          <h3>Onde você mais gasta</h3>
          <table>
            <thead>
              <tr>
                <th>Estabelecimento</th>
                <th className="num">Compras</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {top.map((e) => (
                <tr key={e.descricao}>
                  <td style={{ textTransform: "capitalize" }}>{e.descricao}</td>
                  <td className="num">{e.vezes}</td>
                  <td className="num">{fmt(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
