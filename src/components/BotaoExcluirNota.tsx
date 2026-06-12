"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BotaoExcluirNota({
  notaId,
  descricao,
  aposExcluir = "refresh",
  compacto = false,
}: {
  notaId: string;
  /** Nome exibido na confirmação (estabelecimento ou número) */
  descricao: string;
  aposExcluir?: "refresh" | "voltar";
  compacto?: boolean;
}) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    if (
      !window.confirm(
        `Excluir a nota "${descricao}"?\n\nOs itens e o gasto lançado a partir dela também serão removidos.`
      )
    ) {
      return;
    }
    setExcluindo(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/notas/${notaId}`, { method: "DELETE" });
      const json = await resp.json();
      if (!resp.ok) {
        setErro(json.erro ?? "Falha ao excluir.");
        setExcluindo(false);
        return;
      }
      if (aposExcluir === "voltar") router.push("/notas");
      router.refresh();
    } catch {
      setErro("Erro de rede ao excluir.");
      setExcluindo(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        className="btn btn-perigo"
        style={compacto ? { padding: "6px 10px", fontSize: 13 } : undefined}
        disabled={excluindo}
        onClick={excluir}
        title="Excluir nota, itens e gasto lançado"
      >
        {excluindo ? "Excluindo..." : "🗑️ Excluir"}
      </button>
      {erro && <span className="msg-erro" style={{ marginTop: 0, fontSize: 13 }}>{erro}</span>}
    </span>
  );
}
