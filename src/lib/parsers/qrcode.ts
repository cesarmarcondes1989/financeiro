import sharp from "sharp";
import jsQR from "jsqr";

type Proc = "cinza" | "limiar" | "normal";

function aplicar(s: sharp.Sharp, proc: Proc): sharp.Sharp {
  if (proc === "cinza") return s.grayscale().normalise();
  if (proc === "limiar") return s.grayscale().normalise().sharpen().threshold(140);
  return s;
}

async function decodificar(s: sharp.Sharp): Promise<string | null> {
  try {
    const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    // jsQR exige RGBA (4 canais). Como grayscale()/threshold() produzem 1 ou 2
    // canais, expandimos manualmente para RGBA, replicando o valor de cinza.
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const src = i * channels;
      let r: number, g: number, b: number, a = 255;
      if (channels >= 3) {
        r = data[src];
        g = data[src + 1];
        b = data[src + 2];
        if (channels === 4) a = data[src + 3];
      } else {
        r = g = b = data[src]; // 1 canal (cinza) ou 2 (cinza+alpha)
        if (channels === 2) a = data[src + 1];
      }
      const dst = i * 4;
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      rgba[dst + 3] = a;
    }

    const res = jsQR(rgba, width, height, { inversionAttempts: "attemptBoth" });
    return res?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Decodifica um QR Code presente em uma foto de cupom fiscal.
 *
 * Estratégia em duas etapas, pois o `jsQR` tem dificuldade com QR pequeno:
 *  1) imagem inteira em várias escalas e pré-processamentos (cinza, alto contraste);
 *  2) varredura em blocos sobrepostos — isola um QR pequeno dentro do cupom e
 *     o amplia antes de tentar decodificar.
 */
export async function lerQrCodeDaFoto(buffer: Buffer): Promise<string | null> {
  // Corrige a orientação (EXIF) uma única vez e reaproveita o resultado
  const corrigida = await sharp(buffer).rotate().toBuffer();

  // Etapa 1 — imagem inteira
  for (const largura of [1400, 1000, 2000]) {
    for (const proc of ["cinza", "limiar"] as Proc[]) {
      const r = await decodificar(
        aplicar(sharp(corrigida).resize({ width: largura, withoutEnlargement: true }), proc)
      );
      if (r) return r;
    }
  }

  // Etapa 2 — varredura em blocos sobrepostos (50%) sobre versão em alta
  const trabalho = await sharp(corrigida)
    .resize({ width: 2000, withoutEnlargement: true })
    .toBuffer();
  const meta = await sharp(trabalho).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;

  if (W >= 200 && H >= 200) {
    const cols = 2;
    const rows = 3;
    const blocoW = Math.floor(W / cols);
    const blocoH = Math.floor(H / rows);
    const passoX = Math.max(1, Math.floor(blocoW / 2));
    const passoY = Math.max(1, Math.floor(blocoH / 2));

    for (let y = 0; y + blocoH <= H; y += passoY) {
      for (let x = 0; x + blocoW <= W; x += passoX) {
        const r = await decodificar(
          sharp(trabalho)
            .extract({ left: x, top: y, width: blocoW, height: blocoH })
            .resize({ width: 900 })
            .grayscale()
            .normalise()
            .sharpen()
        );
        if (r) return r;
      }
    }
  }

  return null;
}
