import { NextRequest, NextResponse } from "next/server";
import { lerQrCodeDaFoto } from "@/lib/parsers/qrcode";
import { interpretarQrCodeNfce } from "@/lib/nfce";
import { inserirNota, inserirTransacoes, registrarEvento } from "@/lib/dados";
import { PONTOS } from "@/lib/gamification";

export const runtime = "nodejs";

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
        { erro: "Nenhum QR Code encontrado na foto. Aproxime a câmera do QR Code do cupom e tente novamente." },
        { status: 422 }
      );
    }

    const dados = interpretarQrCodeNfce(conteudoQr);
    if (!dados) {
      return NextResponse.json(
        { erro: "QR Code lido, mas não parece ser de uma NFC-e.", conteudo: conteudoQr },
        { status: 422 }
      );
    }

    const { nota, jaExistia } = await inserirNota({
      chave_acesso: dados.chaveAcesso,
      url_consulta: dados.urlConsulta || null,
      emitente_cnpj: dados.emitenteCnpj ?? null,
      numero: dados.numero ?? null,
      serie: dados.serie ?? null,
      uf: dados.uf ?? null,
      data_emissao: dados.dataEmissao ?? null,
      valor_total: dados.valorTotal ?? null,
    });

    if (!jaExistia) {
      await registrarEvento("nota_registrada", PONTOS.NOTA_REGISTRADA, `NFC-e ${dados.chaveAcesso}`);

      // Se o QR trouxe valor e data, registra também como transação
      if (dados.valorTotal && dados.dataEmissao) {
        await inserirTransacoes(
          [
            {
              data: dados.dataEmissao.slice(0, 10),
              descricao: `NFC-e ${dados.numero ?? ""} CNPJ ${dados.emitenteCnpj ?? ""}`.trim(),
              valor: dados.valorTotal,
              categoria: "Mercado",
            },
          ],
          "nfce"
        );
      }
    }

    return NextResponse.json({ ok: true, jaExistia, nota, dados });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
