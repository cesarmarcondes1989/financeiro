"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Estado = { tipo: "ok" | "erro"; texto: string } | null;
type Painel = "chave" | "foto" | "manual" | "excel" | "pdf" | null;

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mensagemNota(json: {
  jaExistia?: boolean;
  itensImportados?: number;
  valorTotal?: number | null;
}): string {
  if (json.jaExistia) {
    return json.itensImportados
      ? `Nota já registrada — ${json.itensImportados} itens da SEFAZ!${
          json.valorTotal ? ` Total: ${fmtBRL(json.valorTotal)}.` : ""
        }`
      : "Esta nota já estava registrada.";
  }
  const valor = json.valorTotal ? ` — ${fmtBRL(json.valorTotal)}` : "";
  const itens = json.itensImportados
    ? ` ${json.itensImportados} itens da SEFAZ.`
    : " Abra a nota para buscar os itens.";
  return `Nota registrada!${valor}${itens}`;
}

async function lerQrNoNavegador(file: File): Promise<string | null> {
  if (!window.BarcodeDetector) return null;
  try {
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    const codigos = await detector.detect(bitmap);
    bitmap.close();
    return codigos[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

// ── Painel: Chave de acesso ─────────────────────────
function PainelChave({ onFechar }: { onFechar: () => void }) {
  const [chave, setChave] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);
  const digitos = chave.replace(/\D/g, "").length;

  async function enviar() {
    setEnviando(true);
    setEstado(null);
    try {
      const resp = await fetch("/api/notas/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chave,
          valorTotal: valor ? parseFloat(valor.replace(/\./g, "").replace(",", ".")) : undefined,
          dataEmissao: data || undefined,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) setEstado({ tipo: "erro", texto: json.erro ?? "Falha ao registrar." });
      else { setEstado({ tipo: "ok", texto: mensagemNota(json) }); setChave(""); setValor(""); setData(""); }
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede." });
    } finally { setEnviando(false); }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ textTransform: "none", fontSize: 15, color: "var(--text)" }}>🔢 Chave de acesso (44 dígitos)</h2>
        <button onClick={onFechar} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <input type="text" inputMode="numeric" placeholder="Cole ou digite os 44 dígitos" value={chave} onChange={(e) => setChave(e.target.value)} />
          <small style={{ color: digitos === 44 ? "var(--green)" : "var(--text-dim)", fontSize: 12 }}>{digitos}/44 dígitos</small>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="text" inputMode="decimal" placeholder="Valor (ex.: 154,37)" value={valor} onChange={(e) => setValor(e.target.value)} />
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ colorScheme: "dark" }} />
        </div>
        <button className="btn" disabled={enviando || digitos !== 44} onClick={enviar}>
          {enviando ? "Registrando..." : "Registrar nota"}
        </button>
      </div>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

// ── Painel: Foto do QR ──────────────────────────────
function PainelFoto({ onFechar }: { onFechar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);

  async function processar(file: File) {
    setEnviando(true);
    setEstado(null);
    try {
      const conteudo = await lerQrNoNavegador(file);
      let resp: Response;
      if (conteudo) {
        resp = await fetch("/api/notas/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo }) });
      } else {
        const form = new FormData();
        form.append("arquivo", file);
        resp = await fetch("/api/upload/foto", { method: "POST", body: form });
      }
      const json = await resp.json();
      if (!resp.ok) setEstado({ tipo: "erro", texto: json.erro ?? "Falha no envio." });
      else setEstado({ tipo: "ok", texto: mensagemNota(json) });
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede ao enviar." });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function abrir(capture: boolean) {
    if (!inputRef.current) return;
    if (capture) inputRef.current.setAttribute("capture", "environment");
    else inputRef.current.removeAttribute("capture");
    inputRef.current.click();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ textTransform: "none", fontSize: 15, color: "var(--text)" }}>🖼️ Foto do QR Code</h2>
        <button onClick={onFechar} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) processar(f); }} />
      <div style={{ display: "grid", gap: 8 }}>
        <button className="btn" disabled={enviando} onClick={() => abrir(true)}>{enviando ? "Lendo..." : "📸 Tirar foto"}</button>
        <button className="btn btn-secundario" disabled={enviando} onClick={() => abrir(false)}>{enviando ? "Lendo..." : "🖼️ Da galeria"}</button>
      </div>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

// ── Painel: Cadastro manual ─────────────────────────
function PainelManual({ onFechar }: { onFechar: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [desc, setDesc] = useState("");
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Outros");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);

  const CATS = ["Alimentação","Mercado","Transporte","Saúde","Assinaturas e Serviços","Casa e Contas","Compras","Educação","Lazer e Viagem","Pets","Outros"];

  async function enviar() {
    setEnviando(true);
    setEstado(null);
    try {
      const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
      const resp = await fetch("/api/transacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descricao: desc, data, valor: v, categoria }) });
      const json = await resp.json();
      if (!resp.ok) setEstado({ tipo: "erro", texto: json.erro ?? "Falha." });
      else if (json.inseridas === 0) setEstado({ tipo: "ok", texto: "Duplicada — já estava registrada." });
      else { setEstado({ tipo: "ok", texto: "Gasto registrado!" }); setDesc(""); setValor(""); setData(hoje); }
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede." });
    } finally { setEnviando(false); }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ textTransform: "none", fontSize: 15, color: "var(--text)" }}>✏️ Cadastro manual</h2>
        <button onClick={onFechar} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <input type="text" placeholder="Descrição (ex.: Almoço Restaurante)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ colorScheme: "dark" }} />
          <input type="text" inputMode="decimal" placeholder="Valor (47,90)" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn" disabled={enviando || !desc.trim() || !valor.trim()} onClick={enviar}>
          {enviando ? "Salvando..." : "Registrar gasto"}
        </button>
      </div>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

// ── Painel: Arquivo (Excel/PDF) ─────────────────────
function PainelArquivo({ tipo, onFechar }: { tipo: "excel" | "pdf"; onFechar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);

  const config = tipo === "excel"
    ? { titulo: "📊 Excel / CSV", accept: ".xlsx,.xls,.csv", endpoint: "/api/upload/excel" }
    : { titulo: "📄 PDF da fatura", accept: "application/pdf,.pdf", endpoint: "/api/upload/pdf" };

  async function enviar(file: File) {
    setEnviando(true);
    setEstado(null);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const resp = await fetch(config.endpoint, { method: "POST", body: form });
      const json = await resp.json();
      if (!resp.ok) setEstado({ tipo: "erro", texto: json.erro ?? "Falha no envio." });
      else setEstado({ tipo: "ok", texto: `${json.inseridas} transações importadas (${json.duplicadas ?? 0} já existiam).` });
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede ao enviar." });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ textTransform: "none", fontSize: 15, color: "var(--text)" }}>{config.titulo}</h2>
        <button onClick={onFechar} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <input ref={inputRef} type="file" accept={config.accept} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }} />
      <button className="btn" disabled={enviando} onClick={() => inputRef.current?.click()}>
        {enviando ? "Enviando..." : `Escolher arquivo`}
      </button>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

// ── Página principal ────────────────────────────────
export default function PaginaUpload() {
  const [painel, setPainel] = useState<Painel>(null);

  return (
    <>
      <h1>Importar</h1>

      <div className="opcoes-grid">
        <Link href="/notas/scanner" className="opcao-card destaque">
          <span className="opcao-icone">📷</span>
          <span className="opcao-titulo">Scanner ao vivo</span>
          <span className="opcao-sub">QR Code em tempo real</span>
        </Link>
        {(["manual","foto","chave","excel","pdf"] as Painel[]).map((id) => {
          const cfg: Record<NonNullable<Painel>, { icone: string; titulo: string; sub: string }> = {
            manual: { icone: "✏️", titulo: "Lançar manualmente", sub: "Dinheiro ou débito" },
            foto:   { icone: "🖼️", titulo: "Foto do QR", sub: "Galeria ou câmera" },
            chave:  { icone: "🔢", titulo: "44 dígitos", sub: "Chave de acesso NFC-e" },
            excel:  { icone: "📊", titulo: "Excel / CSV", sub: "Fatura exportada" },
            pdf:    { icone: "📄", titulo: "PDF da fatura", sub: "Extrai automaticamente" },
          };
          const c = cfg[id!];
          return (
            <button
              key={id}
              className={`opcao-card${painel === id ? " destaque" : ""}`}
              onClick={() => setPainel(painel === id ? null : id)}
            >
              <span className="opcao-icone">{c.icone}</span>
              <span className="opcao-titulo">{c.titulo}</span>
              <span className="opcao-sub">{c.sub}</span>
            </button>
          );
        })}
      </div>

      {painel === "chave" && <PainelChave onFechar={() => setPainel(null)} />}
      {painel === "foto" && <PainelFoto onFechar={() => setPainel(null)} />}
      {painel === "manual" && <PainelManual onFechar={() => setPainel(null)} />}
      {painel === "excel" && <PainelArquivo tipo="excel" onFechar={() => setPainel(null)} />}
      {painel === "pdf" && <PainelArquivo tipo="pdf" onFechar={() => setPainel(null)} />}
    </>
  );
}
