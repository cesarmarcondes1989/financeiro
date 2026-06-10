"use client";

import { useRef, useState } from "react";

type Estado = { tipo: "ok" | "erro"; texto: string } | null;

function CartaoUpload({
  titulo,
  descricao,
  endpoint,
  accept,
  capture,
  rotuloBotao,
}: {
  titulo: string;
  descricao: string;
  endpoint: string;
  accept: string;
  capture?: boolean;
  rotuloBotao: string;
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
      if (!resp.ok) {
        setEstado({ tipo: "erro", texto: json.erro ?? "Falha no envio." });
      } else if (json.nota) {
        setEstado({
          tipo: "ok",
          texto: json.jaExistia
            ? "Esta nota já estava registrada."
            : `Nota registrada! Chave ${json.dados.chaveAcesso}${
                json.dados.valorTotal ? ` — ${json.dados.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""
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

  return (
    <div className="card">
      <h3>{titulo}</h3>
      <div className="dropzone">
        <p>{descricao}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          {...(capture ? { capture: "environment" as const } : {})}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
          }}
        />
        <button
          className="btn"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
        >
          {enviando ? "Enviando..." : rotuloBotao}
        </button>
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
          descricao="Fotografe o QR Code no rodapé do cupom fiscal. A nota é registrada com chave de acesso, CNPJ do emitente, data e valor."
          endpoint="/api/upload/foto"
          accept="image/*"
          capture
          rotuloBotao="Tirar foto / escolher imagem"
        />
        <CartaoUpload
          titulo="📊 Planilha Excel / CSV"
          descricao="Envie a fatura exportada do app do banco (.xlsx, .xls ou .csv) com colunas de data, descrição e valor."
          endpoint="/api/upload/excel"
          accept=".xlsx,.xls,.csv"
          rotuloBotao="Escolher planilha"
        />
        <CartaoUpload
          titulo="📄 PDF da fatura"
          descricao="Envie o PDF da fatura do cartão. As transações são extraídas e categorizadas automaticamente."
          endpoint="/api/upload/pdf"
          accept="application/pdf,.pdf"
          rotuloBotao="Escolher PDF"
        />
        <div className="card">
          <h3>ℹ️ Como funciona</h3>
          <ul style={{ color: "var(--text-dim)", fontSize: 14, paddingLeft: 18, display: "grid", gap: 8 }}>
            <li>O QR Code da NFC-e contém a chave de acesso da nota — usamos isso para registrá-la e somar o valor aos seus gastos.</li>
            <li>Os itens do cupom podem ser conferidos e lançados na página da nota (a consulta automática na SEFAZ varia por estado).</li>
            <li>Transações são categorizadas por palavras-chave (iFood → Alimentação, Uber → Transporte etc.).</li>
            <li>Importar o mesmo arquivo duas vezes não duplica nada.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
