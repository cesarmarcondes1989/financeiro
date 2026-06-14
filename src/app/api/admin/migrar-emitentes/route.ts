import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { atualizarNota } from "@/lib/dados";
import { consultarNfceNaSefaz } from "@/lib/sefaz";

export const runtime = "nodejs";
export const maxDuration = 300;

// URLs públicas de consulta NFC-e por cUF (2 primeiros dígitos da chave)
const URL_SEFAZ: Record<string, string[]> = {
  "35": ["https://nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?chNFe="],
  "31": ["https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?chNFe="],
  "43": ["https://www.sefaz.rs.gov.br/NFCEConsulta/app/index.xhtml?chNFe="],
  "41": ["https://www.fazenda.pr.gov.br/nfce/consulta?chNFe="],
  "42": ["https://sat.sef.sc.gov.br/nfce/consulta?chNFe="],
  "33": ["https://nfce.fazenda.rj.gov.br/consulta/?chNFe="],
  "52": ["https://nfeweb.sefaz.go.gov.br/nfeweb/consultas/consulta_nfce.aspx?chave="],
  "29": ["https://nfe.sefaz.ba.gov.br/servicos/nfce-qrcode-consulta/listaQRCode.aspx?chNFe="],
  "26": ["https://nfce.sefaz.pe.gov.br/nfce/consulta?chNFe="],
  "23": ["https://nfce.sefaz.ce.gov.br/pages/showNFCe.html?chave="],
  "53": ["https://www.fazenda.df.gov.br/nfce/danfce.aspx?chNFe="],
  "51": ["https://www.sefaz.mt.gov.br/nfce/consultanfce?chave="],
  "50": ["https://www.dfe.ms.gov.br/nfce/danfce.aspx?chNFe="],
};

// Fallback SVRS (usado por vários estados)
const SVRS = "https://nfce.svrs.rs.gov.br/consulta/qrCode.aspx?chNFe=";

function construirUrls(chave: string): string[] {
  const uf = chave.slice(0, 2);
  const especificas = URL_SEFAZ[uf] ?? [];
  return [...especificas, SVRS];
}

async function tentarConsultar(chave: string, urlConsulta?: string | null): Promise<ReturnType<typeof consultarNfceNaSefaz>> {
  // 1. Tenta URL salva no banco (QR code original)
  if (urlConsulta) {
    const r = await consultarNfceNaSefaz(urlConsulta);
    if (r?.emitenteNome) return r;
  }

  // 2. Tenta construir URL pelo cUF da chave
  for (const url of construirUrls(chave)) {
    try {
      const r = await consultarNfceNaSefaz(url + chave);
      if (r?.emitenteNome) return r;
    } catch {
      // tenta o próximo
    }
  }

  return null;
}

export async function GET() {
  const sb = getSupabase();

  // Busca TODAS as notas sem emitente (com ou sem url_consulta)
  const { data: notas, error } = await sb
    .from("notas_fiscais")
    .select("id, url_consulta, emitente_nome, chave_acesso")
    .is("emitente_nome", null)
    .not("chave_acesso", "is", null)
    .limit(200);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  if (!notas?.length) return NextResponse.json({ ok: true, mensagem: "Nenhuma nota pendente.", processadas: 0 });

  const resultados: Array<{ id: string; chave: string; status: string; emitente?: string }> = [];

  for (const nota of notas) {
    const id = nota.id as string;
    const chave = nota.chave_acesso as string;
    const chaveExib = chave.slice(0, 8) + "...";

    try {
      const sefaz = await tentarConsultar(chave, nota.url_consulta as string | null);

      if (!sefaz?.emitenteNome) {
        resultados.push({ id, chave: chaveExib, status: "sem_emitente_no_html" });
        continue;
      }

      await atualizarNota(id, {
        emitente_nome: sefaz.emitenteNome,
        ...(sefaz.emitenteCnpj ? { emitente_cnpj: sefaz.emitenteCnpj } : {}),
        ...(sefaz.municipio ? { municipio: sefaz.municipio } : {}),
        ...(sefaz.dataEmissao ? { data_emissao: sefaz.dataEmissao } : {}),
        ...(sefaz.valorTotal ? { valor_total: sefaz.valorTotal } : {}),
      });

      resultados.push({ id, chave: chaveExib, status: "ok", emitente: sefaz.emitenteNome });
    } catch (e) {
      resultados.push({ id, chave: chaveExib, status: "erro", emitente: e instanceof Error ? e.message : String(e) });
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  const ok = resultados.filter((r) => r.status === "ok").length;
  const semEmitente = resultados.filter((r) => r.status === "sem_emitente_no_html").length;
  const erros = resultados.filter((r) => r.status === "erro").length;

  return NextResponse.json({ ok: true, total: notas.length, atualizadas: ok, sem_emitente_no_html: semEmitente, erros, detalhes: resultados });
}
