import Anthropic from "@anthropic-ai/sdk";

export default async function InsightsIA({ dadosTexto }: { dadosTexto: string }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return (
      <div className="card" style={{ marginBottom: 12, borderColor: "var(--primary)" }}>
        <h2 style={{ marginBottom: 8 }}>🤖 Recomendações da IA</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
          Configure <code style={{ background: "var(--bg-card)", padding: "1px 4px", borderRadius: 4 }}>ANTHROPIC_API_KEY</code> no Vercel para receber análise personalizada dos seus gastos.
        </p>
      </div>
    );
  }

  if (!dadosTexto.trim()) return null;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: "Você é um assistente financeiro pessoal objetivo e direto. Analisa dados reais de compras e dá recomendações práticas para economizar.",
      messages: [
        {
          role: "user",
          content: `Analise esses dados REAIS das minhas compras e me dê 4 recomendações práticas para economizar. Use os valores, lojas e produtos dos dados. Seja específico.

${dadosTexto}

Formato: lista numerada. Cada item começa com emoji. Cite lojas e valores reais. Máximo 2 linhas por recomendação. Responda em português.`,
        },
      ],
    });

    const texto = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    if (!texto) return null;

    const linhas = texto.split("\n").filter((l) => l.trim());

    return (
      <div className="card" style={{ marginBottom: 12, borderLeft: "3px solid var(--primary)" }}>
        <h2 style={{ marginBottom: 12 }}>🤖 Recomendações da IA</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {linhas.map((linha, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.55, margin: 0, color: "var(--text)" }}>
              {linha}
            </p>
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
  }
}
