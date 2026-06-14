import Anthropic from "@anthropic-ai/sdk";
import { CORES_CATEGORIAS } from "./categorize";

const CATEGORIAS = Object.keys(CORES_CATEGORIAS);

/**
 * Categoriza uma lista de descrições usando Claude Haiku.
 * Retorna map { descricao -> categoria }.
 * Se ANTHROPIC_API_KEY não estiver configurada, retorna "Outros" para tudo.
 */
export async function categorizarLote(
  descricoes: string[]
): Promise<Record<string, string>> {
  if (!descricoes.length) return {};
  if (!process.env.ANTHROPIC_API_KEY) {
    return Object.fromEntries(descricoes.map((d) => [d, "Outros"]));
  }

  const client = new Anthropic();
  const unicas = [...new Set(descricoes)];

  const resultado: Record<string, string> = {};
  const tamanhoLote = 80;

  for (let i = 0; i < unicas.length; i += tamanhoLote) {
    const lote = unicas.slice(i, i + tamanhoLote);
    const lista = lote.map((d, idx) => `${idx + 1}. ${d}`).join("\n");

    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Categorize cada item de supermercado/nota fiscal abaixo em UMA das categorias:
${CATEGORIAS.join(", ")}.

Responda SOMENTE com JSON array de strings, mesma ordem e quantidade dos itens.
Exemplo: ["Mercado","Alimentação","Transporte"]

Itens:
${lista}`,
          },
        ],
      });

      const texto = message.content[0]?.type === "text" ? message.content[0].text : "[]";
      const match = texto.match(/\[[\s\S]*\]/);
      if (match) {
        const cats: string[] = JSON.parse(match[0]);
        lote.forEach((d, idx) => {
          resultado[d] = CATEGORIAS.includes(cats[idx]) ? cats[idx] : "Outros";
        });
      } else {
        lote.forEach((d) => { resultado[d] = "Outros"; });
      }
    } catch {
      lote.forEach((d) => { resultado[d] = "Outros"; });
    }
  }

  return resultado;
}

/** Categoriza um único item (usa lote de 1 internamente). */
export async function categorizarItem(descricao: string): Promise<string> {
  const mapa = await categorizarLote([descricao]);
  return mapa[descricao] ?? "Outros";
}
