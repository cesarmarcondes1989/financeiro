"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Botão que dispara a importação dos dados da nota (itens, valor, emitente)
 * a partir do portal da SEFAZ. Usado na página da nota e na listagem.
 */
export default function BotaoSefaz({
  notaId,
  compacto = false,
}: {
  notaId: string;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function buscar() {
    setBuscando(true);
    setMsg(null);
    try {
      const resp = await fetch(`/api/notas/${notaId}/sefaz`, { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) {
        setMsg({ ok: false, texto: json.erro ?? "Falha na consulta." });
      } else {
        setMsg({
          ok: true,
          texto: json.itensImportados
            ? `${json.itensImportados} itens importados!`
            : "Dados atualizados (nenhum item novo).",
        });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, texto: "Erro de rede na consulta." });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        className="btn btn-secundario"
        style={compacto ? { padding: "6px 12px", fontSize: 13, whiteSpace: "nowrap" } : undefined}
        disabled={buscando}
        onClick={buscar}
        title="Importa itens, valor e emitente do portal da SEFAZ"
      >
        {buscando ? "Consultando..." : compacto ? "🔄 Buscar SEFAZ" : "🔄 Buscar itens na SEFAZ"}
      </button>
      {msg && (
        <span className={msg.ok ? "msg-ok" : "msg-erro"} style={{ marginTop: 0, fontSize: 13 }}>
          {msg.texto}
        </span>
      )}
    </span>
  );
}
