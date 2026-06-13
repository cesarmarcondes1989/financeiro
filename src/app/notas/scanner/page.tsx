"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import jsQR from "jsqr";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function mensagemNota(json: {
  jaExistia?: boolean;
  itensImportados?: number;
  valorTotal?: number | null;
}): string {
  if (json.jaExistia) {
    return json.itensImportados
      ? `Nota já registrada — ${json.itensImportados} itens importados da SEFAZ!${
          json.valorTotal ? ` Total: ${fmtBRL(json.valorTotal)}.` : ""
        }`
      : "Esta nota já estava registrada.";
  }
  const valor = json.valorTotal ? ` — ${fmtBRL(json.valorTotal)}` : "";
  const itens = json.itensImportados
    ? ` ${json.itensImportados} itens importados automaticamente da SEFAZ.`
    : " Abra a nota em Notas Fiscais para buscar os itens.";
  return `Nota registrada!${valor}${itens}`;
}

type Fase =
  | { id: "abrindo" }
  | { id: "escaneando" }
  | { id: "processando" }
  | { id: "resultado"; tipo: "ok" | "erro"; texto: string };

export default function PaginaScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const bloqueadoRef = useRef(false);
  const [fase, setFase] = useState<Fase>({ id: "abrindo" });

  const parar = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const processar = useCallback(
    async (conteudo: string) => {
      if (bloqueadoRef.current) return;
      bloqueadoRef.current = true;
      parar();
      setFase({ id: "processando" });
      try {
        const resp = await fetch("/api/notas/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conteudo }),
        });
        const json = await resp.json();
        setFase({
          id: "resultado",
          tipo: resp.ok ? "ok" : "erro",
          texto: resp.ok ? mensagemNota(json) : (json.erro ?? "Falha ao processar."),
        });
      } catch {
        setFase({ id: "resultado", tipo: "erro", texto: "Erro de rede ao processar." });
      }
    },
    [parar]
  );

  const iniciar = useCallback(async () => {
    parar();
    bloqueadoRef.current = false;
    setFase({ id: "abrindo" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      setFase({ id: "resultado", tipo: "erro", texto: "Câmera indisponível ou permissão negada. Tente via Importar." });
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current!;
    video.srcObject = stream;
    await video.play().catch(() => {});
    setFase({ id: "escaneando" });

    const detector = window.BarcodeDetector
      ? new window.BarcodeDetector({ formats: ["qr_code"] })
      : null;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let ultimoTick = 0;
    let scanning = false;

    async function amostra() {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      let resultado: string | null = null;
      if (detector) {
        const codigos = await detector.detect(canvas);
        resultado = codigos[0]?.rawValue ?? null;
      } else {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
        resultado = res?.data ?? null;
      }
      if (resultado) processar(resultado);
    }

    function tick(agora: number) {
      if (!streamRef.current || bloqueadoRef.current) return;
      rafRef.current = requestAnimationFrame(tick);
      if (agora - ultimoTick < 250 || scanning || video.readyState < 2) return;
      ultimoTick = agora;
      scanning = true;
      amostra().finally(() => { scanning = false; });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [parar, processar]);

  useEffect(() => {
    iniciar();
    return () => parar();
  }, [iniciar, parar]);

  const cor = fase.id === "processando" ? "var(--yellow)" : "var(--primary)";

  return (
    <>
      <h1>Scanner QR Code</h1>
      <p className="subtitulo">
        Aponte a câmera para o QR Code do cupom fiscal — o processamento é automático.
      </p>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Viewfinder */}
        <div
          style={{
            position: "relative",
            background: "#000",
            borderRadius: 14,
            overflow: "hidden",
            aspectRatio: "4/3",
            marginBottom: 16,
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Targeting overlay */}
          {(fase.id === "escaneando" || fase.id === "processando") && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 220,
                  height: 220,
                  position: "relative",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  borderRadius: 10,
                  transition: "box-shadow 0.3s",
                }}
              >
                {/* Corner accents */}
                <div style={{ position: "absolute", top: -2, left: -2, width: 24, height: 24, borderTop: `3px solid ${cor}`, borderLeft: `3px solid ${cor}`, borderRadius: "4px 0 0 0", transition: "border-color 0.3s" }} />
                <div style={{ position: "absolute", top: -2, right: -2, width: 24, height: 24, borderTop: `3px solid ${cor}`, borderRight: `3px solid ${cor}`, borderRadius: "0 4px 0 0", transition: "border-color 0.3s" }} />
                <div style={{ position: "absolute", bottom: -2, left: -2, width: 24, height: 24, borderBottom: `3px solid ${cor}`, borderLeft: `3px solid ${cor}`, borderRadius: "0 0 0 4px", transition: "border-color 0.3s" }} />
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderBottom: `3px solid ${cor}`, borderRight: `3px solid ${cor}`, borderRadius: "0 0 4px 0", transition: "border-color 0.3s" }} />

                {/* Scan line (only while scanning) */}
                {fase.id === "escaneando" && (
                  <div className="linha-scan" />
                )}
              </div>
            </div>
          )}

          {/* Status text */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
              padding: "32px 16px 16px",
              textAlign: "center",
              color: "#fff",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            {fase.id === "abrindo" && "Iniciando câmera..."}
            {fase.id === "escaneando" && "Aponte o QR Code para dentro do quadro"}
            {fase.id === "processando" && "⏳ QR Code detectado! Consultando SEFAZ..."}
          </div>
        </div>

        {/* Result panel */}
        {fase.id === "resultado" && (
          <div className="card" style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>
              {fase.tipo === "ok" ? "✅" : "❌"}
            </div>
            <p
              className={fase.tipo === "ok" ? "msg-ok" : "msg-erro"}
              style={{ fontSize: 15, marginBottom: 20, marginTop: 0 }}
            >
              {fase.texto}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn" onClick={iniciar}>
                📷 Escanear outra nota
              </button>
              <Link href="/notas" className="btn btn-secundario">
                Ver Notas Fiscais
              </Link>
            </div>
          </div>
        )}

        {fase.id !== "resultado" && (
          <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 13, marginBottom: 12 }}>
            Sem câmera?{" "}
            <Link href="/upload" style={{ color: "var(--primary-hover)" }}>
              Use a foto ou a chave de acesso
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
