import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase";
import { contarItensPorNota, listarMunicipios, listarNotas } from "@/lib/dados";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";
import BotaoSefaz from "@/components/BotaoSefaz";
import BotaoExcluirNota from "@/components/BotaoExcluirNota";
import FiltroMunicipio from "@/components/FiltroMunicipio";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarCnpj(cnpj?: string | null) {
  if (!cnpj || cnpj.length !== 14) return cnpj ?? "—";
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export default async function PaginaNotas({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string }>;
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Notas Fiscais</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const { municipio } = await searchParams;

  const [notas, itensPorNota, municipios] = await Promise.all([
    listarNotas(municipio ? { municipio } : undefined),
    contarItensPorNota(),
    listarMunicipios(),
  ]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ marginBottom: 0 }}>Notas Fiscais</h1>
        <span style={{ fontSize: 12, color: "var(--text-dim)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 99, padding: "4px 10px" }}>
          {notas.length} notas
        </span>
      </div>

      {/* Filtro município como chips */}
      {municipios.length > 0 && (
        <FiltroMunicipio municipios={municipios} atual={municipio} />
      )}

      {notas.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>
            {municipio
              ? `Nenhuma nota de "${municipio}".`
              : "Nenhuma nota ainda. Escaneie o QR Code de um cupom fiscal."}
          </p>
          <Link href="/notas/scanner" className="btn" style={{ marginTop: 12 }}>
            📷 Abrir scanner
          </Link>
        </div>
      ) : (
        <>
          {notas.map((n) => {
            const qtdItens = itensPorNota[n.id] ?? 0;
            const nome = n.emitente_nome ?? formatarCnpj(n.emitente_cnpj) ?? "Nota Fiscal";
            return (
              <div className="nota-card" key={n.id}>
                <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>🧾</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {nome}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
                    {n.municipio
                      ? <Link href={`/notas?municipio=${encodeURIComponent(n.municipio)}`} style={{ color: "var(--primary-hover)" }}>{n.municipio}</Link>
                      : (n.uf ?? "—")}
                    {" · "}
                    {n.data_emissao
                      ? new Date(n.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {qtdItens > 0 ? (
                      <span className="badge" style={{ background: "rgba(34,197,94,.12)", color: "var(--green)" }}>
                        ✓ {qtdItens} itens
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
                    <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(n.valor_total)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link
                      href={`/notas/${n.id}`}
                      className="btn btn-secundario btn-mini"
                    >
                      Abrir
                    </Link>
                    <BotaoExcluirNota
                      notaId={n.id}
                      descricao={nome}
                      compacto
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
