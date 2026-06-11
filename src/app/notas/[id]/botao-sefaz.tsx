"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BotaoSefaz({ notaId }: { notaId: string }) {
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
            ? `${json.itensImportados} itens importados da SEFAZ!`
            : "Dados da nota atualizados (itens já existiam ou não foram listados).",
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
    <span>
      <button className="btn btn-secundario" disabled={buscando} onClick={buscar}>
        {buscando ? "Consultando SEFAZ..." : "🔄 Buscar itens na SEFAZ"}
      </button>
      {msg && (
        <span className={msg.ok ? "msg-ok" : "msg-erro"} style={{ marginLeft: 10 }}>
          {msg.texto}
        </span>
      )}
    </span>
  );
}
