import { supabaseConfigurado } from "@/lib/supabase";
import { listarTransacoes } from "@/lib/dados";
import { resumoPorMes } from "@/lib/insights";
import { CORES_CATEGORIAS, ICONES_CATEGORIAS } from "@/lib/categorize";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";
import FiltroMes from "@/components/FiltroMes";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PaginaTransacoes({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Transações</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const { mes } = await searchParams;

  // Busca meses disponíveis (sem filtro) + transações do período filtrado
  const [todasTransacoes, transacoes] = await Promise.all([
    listarTransacoes(),
    mes ? listarTransacoes(mes) : listarTransacoes(),
  ]);

  const mesesDisp = [...new Set(resumoPorMes(todasTransacoes).map((m) => m.mes))].sort().reverse();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ marginBottom: 0 }}>Transações</h1>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{transacoes.length} registros</span>
      </div>

      <FiltroMes meses={mesesDisp} atual={mes} base="/transacoes" />

      {transacoes.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>
            {mes ? "Nenhuma transação neste mês." : "Nenhuma transação ainda. Importe uma fatura na tela Importar."}
          </p>
        </div>
      ) : (
        <div className="card">
          {transacoes.map((t) => (
            <div className="item-transacao" key={t.id}>
              <div
                className="item-icone"
                style={{ background: `${CORES_CATEGORIAS[t.categoria] ?? "#64748b"}22` }}
              >
                {ICONES_CATEGORIAS[t.categoria] ?? "💳"}
              </div>
              <div className="item-info">
                <div className="item-nome">
                  {t.descricao}{t.parcela ? ` (${t.parcela})` : ""}
                </div>
                <div className="item-cat">
                  {t.categoria} · {t.origem} · {t.data.split("-").reverse().join("/")}
                </div>
              </div>
              <div className="item-valor">−{fmt(t.valor)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
