"use client";

import { useState, useRef, useEffect } from "react";

type Mensagem = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Onde comprei Red Bull mais barato?",
  "Quanto gastei em mercado esse mês?",
  "Qual loja eu mais visito?",
];

export default function ChatIA() {
  const [aberto, setAberto] = useState(false);
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 100);
  }, [aberto]);

  async function enviar(texto?: string) {
    const msg = (texto ?? input).trim();
    if (!msg || loading) return;

    const novasMensagens: Mensagem[] = [...messages, { role: "user", content: msg }];
    setMessages(novasMensagens);
    setInput("");
    setErro("");
    setLoading(true);

    try {
      const resp = await fetch("/api/analise/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novasMensagens }),
      });
      const json = await resp.json();
      if (json.resposta) {
        setMessages([...novasMensagens, { role: "assistant", content: json.resposta }]);
      } else {
        setErro(json.erro ?? "Falha ao consultar IA.");
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  if (!aberto) {
    return (
      <button
        className="btn"
        onClick={() => setAberto(true)}
        style={{
          width: "100%",
          marginBottom: 16,
          background: "var(--bg-card)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        💬 Perguntar para a IA
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <h2 style={{ fontSize: 15, marginBottom: 0 }}>Pergunte sobre seus gastos</h2>
        </div>
        <button
          onClick={() => { setAberto(false); setMessages([]); setErro(""); }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {messages.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          {SUGESTOES.map((q) => (
            <button
              key={q}
              onClick={() => enviar(q)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "rgba(99,102,241,.08)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 6,
                color: "var(--text-dim)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 12, paddingRight: 2 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  maxWidth: "82%",
                  background:
                    msg.role === "user"
                      ? "var(--primary)"
                      : "rgba(255,255,255,.06)",
                  borderRadius:
                    msg.role === "user"
                      ? "14px 14px 3px 14px"
                      : "14px 14px 14px 3px",
                  padding: "9px 13px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
              <div
                style={{
                  background: "rgba(255,255,255,.06)",
                  borderRadius: "14px 14px 14px 3px",
                  padding: "9px 16px",
                  fontSize: 18,
                  color: "var(--text-dim)",
                }}
              >
                ···
              </div>
            </div>
          )}
          {erro && (
            <p className="msg-erro" style={{ fontSize: 13, marginBottom: 8 }}>
              {erro}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Ex: Onde comprei Red Bull mais barato?"
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "9px 12px",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          className="btn"
          onClick={() => enviar()}
          disabled={loading || !input.trim()}
          style={{ padding: "9px 14px", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          {loading ? "⏳" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
