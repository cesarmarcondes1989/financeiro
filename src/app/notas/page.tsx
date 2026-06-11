import Link from "next/link";
import { supabaseConfigurado } from "@/lib/supabase";
import { listarNotas } from "@/lib/dados";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarCnpj(cnpj?: string | null) {
  if (!cnpj || cnpj.length !== 14) return cnpj ?? "—";
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

export default async function PaginaNotas() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Notas Fiscais</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const notas = await listarNotas();

  return (
    <>
      <h1>Notas Fiscais (NFC-e)</h1>
      <p className="subtitulo">
        Notas registradas pelo QR Code. Clique em uma nota para conferir e lançar os itens.
      </p>
      <div className="card">
        {notas.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            Nenhuma nota ainda. Fotografe o QR Code de um cupom fiscal na página Importar.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Emissão</th>
                <th>Estabelecimento</th>
                <th>UF</th>
                <th className="num">Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id}>
                  <td>
                    {n.data_emissao
                      ? new Date(n.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td>{n.emitente_nome ?? formatarCnpj(n.emitente_cnpj)}</td>
                  <td>{n.uf ?? "—"}</td>
                  <td className="num">
                    {n.valor_total != null ? fmt(n.valor_total) : "—"}
                  </td>
                  <td className="num">
                    <Link href={`/notas/${n.id}`} className="btn btn-secundario" style={{ padding: "6px 12px" }}>
                      Itens
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
