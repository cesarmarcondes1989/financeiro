"use client";

import { useRef, useState } from "react";

type Estado = { tipo: "ok" | "erro"; texto: string } | null;

interface Acao {
  rotulo: string;
  capture?: boolean; // true = abre a câmera; ausente = escolher arquivo/galeria
}

function CartaoUpload({
  titulo,
  descricao,
  endpoint,
  accept,
  acoes,
}: {
  titulo: string;
  descricao: string;
  endpoint: string;
  accept: string;
  acoes: Acao[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<boolean>(false);
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
      if (!resp.ok) {
        setEstado({ tipo: "erro", texto: json.erro ?? "Falha no envio." });
      } else if (json.nota) {
        setEstado({
          tipo: "ok",
          texto: json.jaExistia
            ? "Esta nota já estava registrada."
            : `Nota registrada! Chave ${json.dados.chaveAcesso}${
                json.dados.valorTotal
                  ? ` — ${json.dados.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                  : ""
              }. Veja em Notas Fiscais para conferir os itens.`,
        });
      } else {
        setEstado({
          tipo: "ok",
          texto: `${json.inseridas} transações importadas (${json.duplicadas} já existiam).`,
        });
      }
    } catch {
      setEstado({ tipo: "erro", texto: "Erro de rede ao enviar o arquivo." });
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function abrirSeletor(capture: boolean) {
    if (!inputRef.current) return;
    captureRef.current = capture;
    if (capture) inputRef.current.setAttribute("capture", "environment");
    else inputRef.current.removeAttribute("capture");
    inputRef.current.click();
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {acoes.map((a, i) => (
            <button
              key={a.rotulo}
              className={i === 0 ? "btn" : "btn btn-secundario"}
              disabled={enviando}
              onClick={() => abrirSeletor(Boolean(a.capture))}
            >
              {enviando ? "Enviando..." : a.rotulo}
            </button>
          ))}
        </div>
      </div>
      {estado && (
        <p className={estado.tipo === "ok" ? "msg-ok" : "msg-erro"}>{estado.texto}</p>
      )}
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
        <CartaoUpload
          titulo="📷 Foto do QR Code (NFC-e)"
          descricao="Fotografe ou envie uma imagem nítida do QR Code do cupom. Dica: aproxime bem do QR Code (ele pode ser pequeno na foto inteira do cupom)."
          endpoint="/api/upload/foto"
          accept="image/*"
          acoes={[
            { rotulo: "📸 Tirar foto", capture: true },
            { rotulo: "🖼️ Enviar da galeria" },
          ]}
        />
        <CartaoUpload
          titulo="📊 Planilha Excel / CSV"
          descricao="Envie a fatura exportada do app do banco (.xlsx, .xls ou .csv) com colunas de data, descrição e valor."
          endpoint="/api/upload/excel"
          accept=".xlsx,.xls,.csv"
          acoes={[{ rotulo: "Escolher planilha" }]}
        />
        <CartaoUpload
          titulo="📄 PDF da fatura"
          descricao="Envie o PDF da fatura do cartão. As transações são extraídas e categorizadas automaticamente."
          endpoint="/api/upload/pdf"
          accept="application/pdf,.pdf"
          acoes={[{ rotulo: "Escolher PDF" }]}
        />
        <div className="card">
          <h3>ℹ️ Como funciona</h3>
          <ul style={{ color: "var(--text-dim)", fontSize: 14, paddingLeft: 18, display: "grid", gap: 8 }}>
            <li>O QR Code da NFC-e contém a chave de acesso da nota — usamos isso para registrá-la e somar o valor aos seus gastos.</li>
            <li>Para ler melhor: enquadre o QR Code de perto e com boa luz. A leitura tenta a imagem inteira e também em blocos, para achar QR pequeno.</li>
            <li>Os itens do cupom podem ser conferidos e lançados na página da nota (a consulta automática na SEFAZ varia por estado).</li>
            <li>Importar o mesmo arquivo duas vezes não duplica nada.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
