"use client";

import { useRef, useState } from "react";

type Estado = { tipo: "ok" | "erro"; texto: string } | null;

// BarcodeDetector ainda não está nas tipagens do DOM do TypeScript
interface DetectorQr {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => DetectorQr;
  }
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mensagemNota(json: {
  jaExistia?: boolean;
  itensImportados?: number;
  valorTotal?: number | null;
}): string {
  if (json.jaExistia) return "Esta nota já estava registrada.";
  const valor = json.valorTotal ? ` — ${fmtBRL(json.valorTotal)}` : "";
  const itens = json.itensImportados
    ? ` ${json.itensImportados} itens importados automaticamente da SEFAZ.`
    : " Abra a nota em Notas Fiscais para buscar ou lançar os itens.";
  return `Nota registrada!${valor}${itens}`;
}

/** Tenta ler o QR Code no próprio aparelho (Chrome/Android lê muito melhor). */
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

function CartaoFotoQr() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);

  async function processar(file: File) {
    setEnviando(true);
    setEstado(null);
    try {
      // 1) Tenta decodificar no aparelho (instantâneo e mais preciso)
      const conteudo = await lerQrNoNavegador(file);
      let resp: Response;
      if (conteudo) {
        resp = await fetch("/api/notas/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo }),
        });
      } else {
        // 2) Fallback: o servidor tenta achar o QR na imagem
        const form = new FormData();
        form.append("arquivo", file);
        resp = await fetch("/api/upload/foto", { method: "POST", body: form });
      }
      const json = await resp.json();
      if (!resp.ok) setEstado({ tipo: "erro", texto: json.erro ?? "Falha no envio." });
      else setEstado({ tipo: "ok", texto: mensagemNota(json) });
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede ao enviar a foto." });
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
      <h3>📷 Foto do QR Code (NFC-e)</h3>
      <div className="dropzone">
        <p>
          Fotografe ou envie uma imagem nítida do QR Code do cupom. Se a leitura
          falhar, use a opção de digitar a chave de acesso ao lado.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processar(f);
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn" disabled={enviando} onClick={() => abrir(true)}>
            {enviando ? "Lendo..." : "📸 Tirar foto"}
          </button>
          <button className="btn btn-secundario" disabled={enviando} onClick={() => abrir(false)}>
            {enviando ? "Lendo..." : "🖼️ Enviar da galeria"}
          </button>
        </div>
      </div>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

function CartaoChaveManual() {
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
      else {
        setEstado({ tipo: "ok", texto: mensagemNota(json) });
        setChave("");
        setValor("");
        setData("");
      }
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede ao registrar a nota." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <h3>🔢 Digitar chave de acesso</h3>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 12 }}>
        Se o QR Code não for lido, digite os <b>44 números</b> impressos no cupom
        (logo acima do QR Code). Pode colar com espaços ou pontos.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Chave de acesso (44 dígitos)"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
          <small style={{ color: digitos === 44 ? "var(--green)" : "var(--text-dim)", fontSize: 12 }}>
            {digitos}/44 dígitos
          </small>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Valor total (ex.: 154,37)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            style={{ colorScheme: "dark" }}
          />
        </div>
        <button className="btn" disabled={enviando || digitos !== 44} onClick={enviar}>
          {enviando ? "Registrando..." : "Registrar nota"}
        </button>
      </div>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

function CartaoArquivo({
  titulo,
  descricao,
  endpoint,
  accept,
  rotulo,
}: {
  titulo: string;
  descricao: string;
  endpoint: string;
  accept: string;
  rotulo: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>(null);

  async function enviar(file: File) {
    setEnviando(true);
    setEstado(null);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const resp = await fetch(endpoint, { method: "POST", body: form });
      const json = await resp.json();
      if (!resp.ok) setEstado({ tipo: "erro", texto: json.erro ?? "Falha no envio." });
      else
        setEstado({
          tipo: "ok",
          texto: `${json.inseridas} transações importadas (${json.duplicadas} já existiam).`,
        });
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede ao enviar o arquivo." });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <div className="dropzone">
        <p>{descricao}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
          }}
        />
        <button className="btn" disabled={enviando} onClick={() => inputRef.current?.click()}>
          {enviando ? "Enviando..." : rotulo}
        </button>
      </div>
      {estado && <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>}
    </div>
  );
}

export default function PaginaUpload() {
  return (
    <>
      <h1>Importar gastos</h1>
      <p className="subtitulo">
        Cada importação rende pontos na gamificação. Duplicatas são ignoradas automaticamente.
      </p>
      <div className="grid grid-2">
        <CartaoFotoQr />
        <CartaoChaveManual />
        <CartaoArquivo
          titulo="📊 Planilha Excel / CSV"
          descricao="Envie a fatura exportada do app do banco (.xlsx, .xls ou .csv) com colunas de data, descrição e valor."
          endpoint="/api/upload/excel"
          accept=".xlsx,.xls,.csv"
          rotulo="Escolher planilha"
        />
        <CartaoArquivo
          titulo="📄 PDF da fatura"
          descricao="Envie o PDF da fatura do cartão (sem senha). As transações são extraídas e categorizadas automaticamente."
          endpoint="/api/upload/pdf"
          accept="application/pdf,.pdf"
          rotulo="Escolher PDF"
        />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>ℹ️ Como funciona</h3>
        <ul style={{ color: "var(--text-dim)", fontSize: 14, paddingLeft: 18, display: "grid", gap: 8 }}>
          <li>No celular, o QR Code é lido pelo leitor nativo do navegador (instantâneo); se não der, o servidor tenta achar o QR na foto; e se ainda assim falhar, use a chave de acesso de 44 dígitos.</li>
          <li>A chave é validada pelo dígito verificador e revela CNPJ do emitente, UF, número e mês da nota. Informe o valor e a data para lançar o gasto junto.</li>
          <li>PDFs digitalizados (foto escaneada) ou protegidos por senha não têm texto extraível — gere o PDF pelo app do banco ou use Excel/CSV.</li>
          <li>Importar o mesmo arquivo duas vezes não duplica nada.</li>
        </ul>
      </div>
    </>
  );
}
