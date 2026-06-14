import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase";
import {
  contarItensPorNota,
  listarNotas,
  listarTransacoesNaoNfce,
} from "@/lib/dados";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";
import BotaoSefaz from "@/components/BotaoSefaz";
import BotaoExcluirNota from "@/components/BotaoExcluirNota";
import FiltroGastos from "@/components/FiltroGastos";
import type { NotaFiscal, Transacao } from "@/lib/types";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ultimosMeses(n = 6): string[] {
  const meses: string[] = [];
  const hoje = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

type ItemFeed =
  | { tipo: "nota"; data: string; nota: NotaFiscal; qtdItens: number }
  | { tipo: "transacao"; data: string; transacao: Transacao };

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string }>;
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Gastos</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const { mes, tipo } = await searchParams;
  const meses = ultimosMeses(6);

  const [notas, transacoes, itensPorNota] = await Promise.all([
    tipo === "manual" ? Promise.resolve([]) : listarNotas(mes ? { mes } : undefined),
    tipo === "nota" ? Promise.resolve([]) : listarTransacoesNaoNfce(mes),
    contarItensPorNota(),
  ]);

  const feed: ItemFeed[] = [
    ...notas.map((n): ItemFeed => ({
      tipo: "nota",
      data: n.data_emissao?.slice(0, 10) ?? n.criado_em?.slice(0, 10) ?? "1970-01-01",
      nota: n,
      qtdItens: itensPorNota[n.id] ?? 0,
    })),
    ...transacoes.map((t): ItemFeed => ({
      tipo: "transacao",
      data: t.data,
      transacao: t,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const totalVisivel = feed.reduce((sum, item) => {
    const v = item.tipo === "nota" ? (item.nota.valor_total ?? 0) : item.transacao.valor;
    return sum + v;
  }, 0);

  const origemLabel: Record<string, string> = { manual: "MANUAL", excel: "EXCEL", pdf: "PDF" };
  const origemCor: Record<string, string> = {
    manual: "rgba(249,115,22,.15)",
    excel: "rgba(34,197,94,.15)",
    pdf: "rgba(239,68,68,.15)",
  };
  const origemTextCor: Record<string, string> = {
    manual: "#f97316",
    excel: "#22c55e",
    pdf: "#ef4444",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ marginBottom: 0 }}>Gastos</h1>
        {totalVisivel > 0 && (
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--red)" }}>
            {fmt(totalVisivel)}
          </span>
        )}
      </div>

      <FiltroGastos meses={meses} mesAtual={mes} tipoAtual={tipo} />

      <div style={{ marginTop: 16 }}>
        {feed.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-dim)" }}>
              Nenhum gasto encontrado. Escaneie um QR Code ou lance um gasto manualmente.
            </p>
            <Link href="/upload" className="btn" style={{ display: "inline-block", marginTop: 12 }}>
              ➕ Importar
            </Link>
          </div>
        ) : (
          feed.map((item, idx) => {
            if (item.tipo === "nota") {
              const n = item.nota;
              const nome = n.emitente_nome ?? `CNPJ ${n.emitente_cnpj ?? "—"}`;
              const dataExib = item.data !== "1970-01-01"
                ? new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")
                : "—";
              return (
                <div className="nota-card" key={`nota-${n.id}`}>
                  <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🧾</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(99,102,241,.15)", color: "var(--primary-hover)", borderRadius: 4, padding: "1px 5px", letterSpacing: 0.4 }}>
                        NOTA
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {nome}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {dataExib}{n.municipio ? ` · ${n.municipio}` : ""}
                    </div>
                    <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.qtdItens > 0 ? (
                        <span className="badge" style={{ background: "rgba(34,197,94,.12)", color: "var(--green)" }}>
                          ✓ {item.qtdItens} itens
                        </span>
                      ) : n.url_consulta ? (
                        <BotaoSefaz notaId={n.id} compacto />
                      ) : (
                        <span className="badge">sem itens</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    {n.valor_total != null && (
                      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(n.valor_total)}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <Link href={`/notas/${n.id}`} className="btn btn-secundario btn-mini">
                        Ver
                      </Link>
                      <BotaoExcluirNota notaId={n.id} descricao={nome} compacto />
                    </div>
                  </div>
                </div>
              );
            }

            const t = item.transacao;
            return (
              <div className="nota-card" key={`trans-${t.id}-${idx}`}>
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>✏️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: origemCor[t.origem] ?? "rgba(99,102,241,.15)",
                      color: origemTextCor[t.origem] ?? "var(--primary-hover)",
                      borderRadius: 4,
                      padding: "1px 5px",
                      letterSpacing: 0.4,
                    }}>
                      {origemLabel[t.origem] ?? t.origem.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.descricao}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {new Date(t.data + "T12:00:00").toLocaleDateString("pt-BR")} · {t.categoria}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: "var(--red)" }}>
                  {fmt(t.valor)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
