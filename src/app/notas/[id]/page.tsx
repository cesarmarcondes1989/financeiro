import { notFound } from "next/navigation";
import { supabaseConfigurado } from "@/lib/supabase";
import { buscarNota } from "@/lib/dados";
import AvisoConfiguracao from "@/components/AvisoConfiguracao";
import FormItens from "./form-itens";
import EditarNota from "./editar-nota";
import ItensEditaveis from "./itens-editaveis";
import BotaoSefaz from "@/components/BotaoSefaz";
import BotaoExcluirNota from "@/components/BotaoExcluirNota";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PaginaNota({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <h1>Nota Fiscal</h1>
        <AvisoConfiguracao />
      </>
    );
  }

  const { id } = await params;
  const resultado = await buscarNota(id);
  if (!resultado) notFound();
  const { nota, itens } = resultado;
  const somaItens = itens.reduce((a, i) => a + i.valor_total, 0);

  return (
    <>
      <h1>
        {nota.emitente_nome
          ? nota.emitente_nome
          : `Nota ${nota.numero ?? nota.chave_acesso.slice(25, 34)}`}
      </h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
        <EditarNota
          notaId={nota.id}
          emitenteNome={nota.emitente_nome ?? null}
          dataEmissao={nota.data_emissao ?? null}
          valorTotal={nota.valor_total ?? null}
        />
        <BotaoExcluirNota
          notaId={nota.id}
          descricao={nota.emitente_nome ?? `Nota ${nota.numero ?? nota.chave_acesso.slice(25, 34)}`}
          aposExcluir="voltar"
        />
      </div>
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>Valor total</h2>
          <div className="kpi">{nota.valor_total != null ? fmt(nota.valor_total) : "—"}</div>
          <div className="kpi-sub">
            itens lançados: {fmt(somaItens)}
            {nota.valor_total != null && somaItens > 0 && Math.abs(somaItens - nota.valor_total) > 0.01
              ? ` (faltam ${fmt(nota.valor_total - somaItens)})`
              : somaItens > 0 ? " ✓" : ""}
          </div>
        </div>
        <div className="card">
          <h2>Emissão</h2>
          <div className="kpi" style={{ fontSize: 20 }}>
            {nota.data_emissao ? new Date(nota.data_emissao).toLocaleDateString("pt-BR") : "—"}
          </div>
          <div className="kpi-sub">UF: {nota.uf ?? "—"} · Série {nota.serie ?? "—"}</div>
        </div>
        <div className="card">
          <h2>Chave de acesso</h2>
          <div style={{ fontSize: 13, wordBreak: "break-all", fontFamily: "monospace" }}>
            {nota.chave_acesso}
          </div>
          {nota.url_consulta && (
            <a
              href={nota.url_consulta}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--primary-hover)", fontSize: 13 }}
            >
              Consultar na SEFAZ ↗
            </a>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h3 style={{ marginBottom: 0 }}>Itens da nota</h3>
          <BotaoSefaz notaId={nota.id} />
        </div>
        {itens.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
            Nenhum item lançado. Use o botão acima para importar automaticamente
            da SEFAZ, ou lance os itens manualmente abaixo.
          </p>
        ) : (
          <ItensEditaveis itens={itens} />
        )}
      </div>

      <FormItens notaId={nota.id} />
    </>
  );
}
