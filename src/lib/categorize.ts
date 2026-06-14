/** Categorização automática por palavras-chave na descrição (pt-BR). */

const REGRAS: Array<{ categoria: string; palavras: string[] }> = [
  {
    categoria: "Alimentação",
    palavras: [
      "ifood", "restaurante", "lanchonete", "padaria", "pizzaria", "burger",
      "burguer", "hamburg", "mcdonald", "bk ", "subway", "sushi", "churrasc",
      "cafeteria", "cafe ", "café", "bar ", "boteco", "delivery", "rappi",
    ],
  },
  {
    categoria: "Mercado",
    palavras: [
      "supermerc", "mercado", "atacad", "carrefour", "assai", "assaí", "extra",
      "pao de acucar", "pão de açúcar", "dia%", "sams club", "hortifruti",
      "sacolao", "sacolão", "acougue", "açougue", "emporio", "empório",
    ],
  },
  {
    categoria: "Transporte",
    palavras: [
      "uber", "99app", "99 tec", "99*", "cabify", "posto", "combustivel",
      "combustível", "gasolina", "etanol", "shell", "ipiranga", "petrobras",
      "estacionamento", "pedagio", "pedágio", "metro", "metrô", "onibus",
      "ônibus", "bilhete unico", "sem parar", "veloe", "conectcar",
    ],
  },
  {
    categoria: "Saúde",
    palavras: [
      "farmacia", "farmácia", "drogaria", "droga raia", "drogasil", "pacheco",
      "panvel", "hospital", "clinica", "clínica", "laborator", "laboratór",
      "academia", "smartfit", "smart fit", "plano de saude", "unimed", "amil",
    ],
  },
  {
    categoria: "Assinaturas e Serviços",
    palavras: [
      "netflix", "spotify", "amazon prime", "prime video", "disney", "hbo",
      "max.com", "globoplay", "youtube", "apple.com", "apple servic", "icloud",
      "google one", "google storage", "deezer", "crunchyroll", "twitch",
      "playstation", "xbox", "steam", "nintendo", "chatgpt", "openai", "claude",
    ],
  },
  {
    categoria: "Casa e Contas",
    palavras: [
      "energia", "enel", "light", "cemig", "copel", "celesc", "sabesp",
      "sanepar", "agua", "água", "condominio", "condomínio", "aluguel",
      "internet", "vivo", "claro", "tim ", "oi ", "net serv", "gas ", "gás",
      "leroy", "telhanorte", "tok stok", "tok&stok", "madeiramadeira",
    ],
  },
  {
    categoria: "Compras",
    palavras: [
      "amazon", "mercadolivre", "mercado livre", "mercadopago", "shopee",
      "aliexpress", "shein", "magalu", "magazine", "americanas", "casas bahia",
      "renner", "riachuelo", "c&a", "zara", "centauro", "decathlon", "nike",
      "adidas", "kabum", "fast shop", "livraria", "shopping",
    ],
  },
  {
    categoria: "Educação",
    palavras: [
      "udemy", "alura", "coursera", "escola", "faculdade", "universidade",
      "curso", "mensalidade", "kindle", "duolingo",
    ],
  },
  {
    categoria: "Lazer e Viagem",
    palavras: [
      "cinema", "cinemark", "kinoplex", "ingresso", "show", "teatro", "hotel",
      "airbnb", "booking", "latam", "gol ", "azul ", "decolar", "123milhas",
      "passagem", "viagem", "parque",
    ],
  },
  {
    categoria: "Pets",
    palavras: ["petz", "cobasi", "petlove", "pet shop", "petshop", "veterinar"],
  },
];

export function categorizar(descricao: string): string {
  const d = ` ${descricao.toLowerCase()} `;
  for (const regra of REGRAS) {
    if (regra.palavras.some((p) => d.includes(p))) return regra.categoria;
  }
  return "Outros";
}

export const CORES_CATEGORIAS: Record<string, string> = {
  "Alimentação": "#f97316",
  "Mercado": "#22c55e",
  "Transporte": "#3b82f6",
  "Saúde": "#ef4444",
  "Assinaturas e Serviços": "#a855f7",
  "Casa e Contas": "#eab308",
  "Compras": "#ec4899",
  "Educação": "#06b6d4",
  "Lazer e Viagem": "#8b5cf6",
  "Pets": "#84cc16",
  "Outros": "#64748b",
};

export const ICONES_CATEGORIAS: Record<string, string> = {
  "Alimentação": "🍔",
  "Mercado": "🛒",
  "Transporte": "🚗",
  "Saúde": "💊",
  "Assinaturas e Serviços": "📱",
  "Casa e Contas": "🏠",
  "Compras": "🛍️",
  "Educação": "📚",
  "Lazer e Viagem": "✈️",
  "Pets": "🐾",
  "Outros": "💳",
};
