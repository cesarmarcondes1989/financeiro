import sharp from "sharp";
import jsQR from "jsqr";

/**
 * Decodifica um QR Code presente em uma foto.
 * Tenta a imagem original e variações (redimensionada, alto contraste,
 * em escala de cinza) para melhorar a taxa de leitura de fotos de cupom.
 */
export async function lerQrCodeDaFoto(buffer: Buffer): Promise<string | null> {
  const variacoes: Array<(img: sharp.Sharp) => sharp.Sharp> = [
    (img) => img,
    (img) => img.resize({ width: 1000, withoutEnlargement: false }),
    (img) => img.grayscale().normalise(),
    (img) => img.grayscale().threshold(128),
    (img) => img.resize({ width: 1600 }).grayscale().normalise(),
  ];

  for (const transformar of variacoes) {
    try {
      const { data, info } = await transformar(sharp(buffer).rotate())
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const resultado = jsQR(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        info.width,
        info.height
      );
      if (resultado?.data) return resultado.data;
    } catch {
      // tenta a próxima variação
    }
  }
  return null;
}
