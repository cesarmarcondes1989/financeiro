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
  const progresso = ((estado.pontos % 100) / 100) * 100;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ marginBottom: 0 }}>Gamificação</h1>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary-hover)", background: "rgba(99,102,241,.12)", border: "1px solid var(--primary)", borderRadius: 99, padding: "4px 12px" }}>
          {estado.pontos} pts
        </span>
      </div>

      {/* Nível */}
      <div className="card" style={{ position: "relative", overflow: "hidden", marginBottom: 12 }}>
        <div style={{ position: "absolute", inset: 0, opacity: .08, background: "radial-gradient(circle at 80% 50%, var(--primary) 0%, transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <h2>Nível {estado.nivel}</h2>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{estado.titulo}</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 10 }}>
            próximo nível em {estado.pontosProximoNivel} pts
          </div>
          <div className="barra"><div style={{ width: `${progresso}%` }} /></div>
        </div>
      </div>

      {/* Grid sequência + conquistas */}
      <div className="grid2">
        <div className="card">
          <h2>Sequência 🔥</h2>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {estado.sequenciaMesesEmQueda} {estado.sequenciaMesesEmQueda === 1 ? "mês" : "meses"}
          </div>
          <div className="kpi-sub">gastando menos</div>
        </div>
        <div className="card">
          <h2>Conquistas</h2>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {estado.conquistas.filter((c) => c.conquistada).length}/{estado.conquistas.length}
          </div>
          <div className="kpi-sub">desbloqueadas</div>
        </div>
      </div>

      {/* Desafios */}
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>🎯 Desafios do mês</h2>
        {estado.desafios.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
            Os desafios aparecem quando houver pelo menos um mês de histórico. Importe suas faturas para começar!
          </p>
        ) : (
          estado.desafios.map((d) => (
            <div key={d.categoria} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, flexWrap: "wrap", gap: 4, marginBottom: 5 }}>
                <span style={{ fontWeight: 600 }}>{d.categoria}</span>
                <span style={{ color: d.vencendo ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                  {d.vencendo ? "✓" : "✗"} {fmt(d.gastoAtual)} / {fmt(d.alvo)}
                </span>
              </div>
              <div className="barra">
                <div
                  className={d.progresso >= 1 ? "estourou" : "ok"}
                  style={{ width: `${Math.min(d.progresso * 100, 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Conquistas */}
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>🏅 Conquistas</h2>
        <div className="conquista-grid">
          {estado.conquistas.map((c) => (
            <div key={c.id} className={`conquista${c.conquistada ? "" : " bloqueada"}`}>
              <span className="icone">{c.icone}</span>
              <b>{c.nome}</b>
              <small>{c.descricao}</small>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico de pontos */}
      {eventos.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Histórico de pontos</h2>
          {eventos.slice(0, 20).map((e) => (
            <div className="item-transacao" key={e.id}>
              <div className="item-icone" style={{ background: "rgba(99,102,241,.15)", fontSize: 16 }}>⭐</div>
              <div className="item-info">
                <div className="item-nome">{e.descricao ?? e.tipo}</div>
                <div className="item-cat">{new Date(e.criado_em).toLocaleDateString("pt-BR")}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--green)", flexShrink: 0 }}>+{e.pontos}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
