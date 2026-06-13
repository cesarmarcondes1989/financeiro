import { supabaseConfigurado } from "@/lib/supabase";
import { listarTransacoes } from "@/lib/dados";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PaginaTransacoes() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Transações</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const transacoes = await listarTransacoes();

  return (
    <>
      <h1>Transações</h1>
      <p className="subtitulo">{transacoes.length} lançamentos registrados</p>
      <div className="card">
        {transacoes.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>
            Nenhuma transação ainda. Importe uma fatura na página Importar.
          </p>
        ) : (
          <div className="tabela-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{t.data.split("-").reverse().join("/")}</td>
                    <td>
                      {t.descricao}
                      {t.parcela ? ` (${t.parcela})` : ""}
                    </td>
                    <td><span className="badge">{t.categoria}</span></td>
                    <td><span className="badge">{t.origem}</span></td>
                    <td className="num">{fmt(t.valor)}</td>
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
