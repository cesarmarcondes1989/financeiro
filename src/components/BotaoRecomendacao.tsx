"use client";

import { useState } from "react";

export default function BotaoRecomendacao() {
  const [estado, setEstado] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [texto, setTexto] = useState("");

  async function buscar() {
    setEstado("loading");
    setTexto("");
    try {
      const resp = await fetch("/api/analise/recomendacao", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok) {
        setEstado("erro");
        setTexto(json.erro ?? "Falha ao buscar recomendação.");
      } else {
        setEstado("ok");
        setTexto(json.recomendacao);
      }
    } catch {
      setEstado("erro");
      setTexto("Erro de rede.");
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        className="btn"
        disabled={estado === "loading"}
        onClick={estado === "ok" ? () => setEstado("idle") : buscar}
        style={{ width: "100%" }}
      >
        {estado === "loading"
          ? "⏳ Analisando seus gastos..."
          : estado === "ok"
          ? "✕ Fechar análise"
          : "🤖 Recomendação"}
      </button>

      {estado === "ok" && texto && (
        <div
          className="card"
          style={{
            marginTop: 12,
            borderLeft: "3px solid var(--primary)",
            background: "rgba(99,102,241,.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <h2 style={{ marginBottom: 0, fontSize: 15 }}>Análise dos seus gastos</h2>
          </div>
          {texto.split("\n").filter((l) => l.trim()).map((paragrafo, i) => (
            <p
              key={i}
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                margin: "0 0 10px 0",
                color: "var(--text)",
              }}
            >
              {paragrafo}
            </p>
          ))}
        </div>
      )}

      {estado === "erro" && (
        <p className="msg-erro" style={{ marginTop: 8 }}>
          {texto}
        </p>
      )}
    </div>
  );
}
