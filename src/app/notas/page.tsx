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
      <h1>Notas Fiscais (NFC-e)</h1>
      <p className="subtitulo">
        Notas registradas pelo QR Code ou pela chave de acesso. Notas sem itens
        têm o botão para importar da SEFAZ.
      </p>

      {/* Filtro por município */}
      {(municipios.length > 0 || municipio) && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <FiltroMunicipio municipios={municipios} atual={municipio} />
          {municipio && (
            <Link href="/notas" style={{ color: "var(--text-dim)", fontSize: 13 }}>
              × Limpar filtro
            </Link>
          )}
        </div>
      )}

      <div className="card">
        {notas.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            {municipio
              ? `Nenhuma nota de "${municipio}". Tente outro município ou limpe o filtro.`
              : "Nenhuma nota ainda. Fotografe o QR Code de um cupom fiscal na página Importar."}
          </p>
        ) : (
          <div className="tabela-scroll">
            <table>
              <thead>
                <tr>
                  <th>Emissão</th>
                  <th>Estabelecimento</th>
                  <th>Município</th>
                  <th className="num">Valor</th>
                  <th className="num">Itens</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {notas.map((n) => {
                  const qtdItens = itensPorNota[n.id] ?? 0;
                  return (
                    <tr key={n.id}>
                      <td>
                        {n.data_emissao
                          ? new Date(n.data_emissao).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td>{n.emitente_nome ?? formatarCnpj(n.emitente_cnpj)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {n.municipio ? (
                          <Link
                            href={`/notas?municipio=${encodeURIComponent(n.municipio)}`}
                            style={{ color: "var(--primary-hover)", fontSize: 13 }}
                          >
                            {n.municipio}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--text-dim)" }}>{n.uf ?? "—"}</span>
                        )}
                      </td>
                      <td className="num">
                        {n.valor_total != null ? fmt(n.valor_total) : "—"}
                      </td>
                      <td className="num">
                        {qtdItens > 0 ? (
                          <span className="badge">{qtdItens} itens</span>
                        ) : n.url_consulta ? (
                          <BotaoSefaz notaId={n.id} compacto />
                        ) : (
                          <span className="badge" title="Registrada pela chave digitada — lance os itens manualmente">
                            sem itens
                          </span>
                        )}
                      </td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        <Link
                          href={`/notas/${n.id}`}
                          className="btn btn-secundario"
                          style={{ padding: "6px 12px", marginRight: 6 }}
                        >
                          Abrir
                        </Link>
                        <BotaoExcluirNota
                          notaId={n.id}
                          descricao={n.emitente_nome ?? formatarCnpj(n.emitente_cnpj)}
                          compacto
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
