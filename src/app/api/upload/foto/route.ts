import { NextRequest, NextResponse } from "next/server";
import { lerQrCodeDaFoto } from "@/lib/parsers/qrcode";
import { registrarNotaDeQr } from "@/lib/notas-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ erro: "Envie uma foto no campo 'arquivo'." }, { status: 400 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const conteudoQr = await lerQrCodeDaFoto(buffer);
    if (!conteudoQr) {
      return NextResponse.json(
        {
          erro:
            "Nenhum QR Code encontrado na foto. Tente fotografar mais de perto e com boa luz — ou digite a chave de acesso (44 dígitos impressos acima do QR Code).",
        },
        { status: 422 }
      );
    }

    const r = await registrarNotaDeQr(conteudoQr);
    if (!r.ok) return NextResponse.json({ erro: r.erro, conteudo: conteudoQr }, { status: r.status });
    return NextResponse.json({ ok: true, jaExistia: r.jaExistia, nota: r.nota, dados: r.dados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
