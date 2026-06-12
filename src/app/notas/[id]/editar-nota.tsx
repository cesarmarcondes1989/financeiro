"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditarNota({
  notaId,
  emitenteNome,
  dataEmissao,
  valorTotal,
}: {
  notaId: string;
  emitenteNome: string | null;
  dataEmissao: string | null;
  valorTotal: number | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(emitenteNome ?? "");
  const [data, setData] = useState(dataEmissao ? dataEmissao.slice(0, 10) : "");
  const [valor, setValor] = useState(valorTotal != null ? String(valorTotal).replace(".", ",") : "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const corpo: Record<string, unknown> = { emitente_nome: nome };
      if (data) corpo.data_emissao = `${data}T12:00:00-03:00`;
      if (valor.trim()) {
        const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
        if (!(v > 0)) {
          setMsg({ ok: false, texto: "Valor inválido." });
          setSalvando(false);
          return;
        }
        corpo.valor_total = v;
      }
      const resp = await fetch(`/api/notas/${notaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await resp.json();
      if (!resp.ok) setMsg({ ok: false, texto: json.erro ?? "Falha ao salvar." });
      else {
        setMsg({ ok: true, texto: "Nota atualizada!" });
        setAberto(false);
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, texto: "Erro de rede ao salvar." });
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button className="btn btn-secundario" onClick={() => setAberto(true)}>
          ✏️ Editar nota
        </button>
        {msg?.ok && <span className="msg-ok" style={{ marginTop: 0, fontSize: 13 }}>{msg.texto}</span>}
      </span>
    );
  }

  return (
    <div className="card" style={{ width: "100%", marginTop: 8 }}>
      <h3>Editar nota</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <input
          type="text"
          placeholder="Nome do estabelecimento"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            style={{ colorScheme: "dark" }}
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Valor total (ex.: 156,69)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" disabled={salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button className="btn btn-secundario" disabled={salvando} onClick={() => setAberto(false)}>
            Cancelar
          </button>
        </div>
        {msg && !msg.ok && <p className="msg-erro">{msg.texto}</p>}
      </div>
    </div>
  );
}
