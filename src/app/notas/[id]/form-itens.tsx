"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Linha {
  descricao: string;
  quantidade: string;
  valor_total: string;
}

const LINHA_VAZIA: Linha = { descricao: "", quantidade: "1", valor_total: "" };

export default function FormItens({ notaId }: { notaId: string }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([{ ...LINHA_VAZIA }]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(i: number, campo: keyof Linha, valor: string) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  async function salvar() {
    setEnviando(true);
    setErro(null);
    const itens = linhas
      .filter((l) => l.descricao.trim() && l.valor_total.trim())
      .map((l) => ({
        descricao: l.descricao.trim(),
        quantidade: parseFloat(l.quantidade.replace(",", ".")) || 1,
        valor_total: parseFloat(l.valor_total.replace(",", ".")),
      }))
      .filter((i) => i.valor_total > 0);

    if (!itens.length) {
      setErro("Preencha pelo menos um item com descrição e valor.");
      setEnviando(false);
      return;
    }

    const resp = await fetch(`/api/notas/${notaId}/itens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    const json = await resp.json();
    setEnviando(false);
    if (!resp.ok) {
      setErro(json.erro ?? "Falha ao salvar itens.");
      return;
    }
    setLinhas([{ ...LINHA_VAZIA }]);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Lançar itens do cupom</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {linhas.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px", gap: 8 }}>
            <input
              type="text"
              placeholder="Descrição do item (ex.: Arroz 5kg)"
              value={l.descricao}
              onChange={(e) => atualizar(i, "descricao", e.target.value)}
            />
            <input
              type="text"
              placeholder="Qtd"
              value={l.quantidade}
              onChange={(e) => atualizar(i, "quantidade", e.target.value)}
            />
            <input
              type="text"
              placeholder="Valor (R$)"
              value={l.valor_total}
              onChange={(e) => atualizar(i, "valor_total", e.target.value)}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          className="btn btn-secundario"
          onClick={() => setLinhas((ls) => [...ls, { ...LINHA_VAZIA }])}
        >
          + Linha
        </button>
        <button className="btn" disabled={enviando} onClick={salvar}>
          {enviando ? "Salvando..." : "Salvar itens"}
        </button>
      </div>
      {erro && <p className="msg-erro">{erro}</p>}
    </div>
  );
}
