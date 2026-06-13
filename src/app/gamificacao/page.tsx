import { supabaseConfigurado } from "@/lib/supabase";
import { contarNotas, listarEventos, listarTransacoes } from "@/lib/dados";
import { calcularEstado } from "@/lib/gamification";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PaginaGamificacao() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Gamificação</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const [eventos, transacoes, totalNotas] = await Promise.all([
    listarEventos(),
    listarTransacoes(),
    contarNotas(),
  ]);
  const estado = calcularEstado(eventos, transacoes, totalNotas);
  const progressoNivel =
    ((estado.pontos % 100) / 100) * 100;

  return (
    <>
      <h1>Gamificação</h1>
      <p className="subtitulo">
        Ganhe pontos registrando notas e importando faturas. Vença desafios gastando menos que sua média.
      </p>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Nível {estado.nivel}</h2>
          <div className="kpi">{estado.titulo}</div>
          <div className="barra"><div style={{ width: `${progressoNivel}%` }} /></div>
          <div className="kpi-sub">
            {estado.pontos} pts · próximo nível em {estado.pontosProximoNivel} pts
          </div>
        </div>
        <div className="card">
          <h2>Sequência de economia</h2>
          <div className="kpi">
            {estado.sequenciaMesesEmQueda} {estado.sequenciaMesesEmQueda === 1 ? "mês" : "meses"} 🔥
          </div>
          <div className="kpi-sub">meses seguidos gastando menos que o anterior</div>
        </div>
        <div className="card">
          <h2>Conquistas</h2>
          <div className="kpi">
            {estado.conquistas.filter((c) => c.conquistada).length}/{estado.conquistas.length}
          </div>
          <div className="kpi-sub">desbloqueadas</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>🎯 Desafios do mês (gaste 10% menos que sua média)</h3>
        {estado.desafios.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Os desafios aparecem quando houver pelo menos um mês anterior de
            histórico. Importe suas faturas para começar!
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {estado.desafios.map((d) => (
              <div key={d.categoria}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, flexWrap: "wrap", gap: 4 }}>
                  <span>
                    <b>{d.categoria}</b>{" "}
                    <span style={{ color: "var(--text-dim)" }}>
                      — alvo {fmt(d.alvo)} (média {fmt(d.baseMedia)})
                    </span>
                  </span>
                  <span style={{ color: d.vencendo ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {fmt(d.gastoAtual)} {d.vencendo ? "✓" : "✗"}
                  </span>
                </div>
                <div className="barra">
                  <div
                    className={d.progresso >= 1 ? "estourou" : "ok"}
                    style={{ width: `${Math.min(d.progresso * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>🏅 Conquistas</h3>
        <div className="grid grid-3">
          {estado.conquistas.map((c) => (
            <div key={c.id} className={`conquista ${c.conquistada ? "" : "bloqueada"}`}>
              <span className="icone">{c.icone}</span>
              <span>
                <b>{c.nome}</b>
                <small>{c.descricao}</small>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Histórico de pontos</h3>
        {eventos.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Nenhum ponto ainda. Registre uma nota ou importe uma fatura!
          </p>
        ) : (
          <div className="tabela-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Ação</th>
                  <th className="num">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {eventos.slice(0, 30).map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(e.criado_em).toLocaleDateString("pt-BR")}</td>
                    <td>{e.descricao ?? e.tipo}</td>
                    <td className="num" style={{ color: "var(--green)", fontWeight: 600 }}>
                      +{e.pontos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
