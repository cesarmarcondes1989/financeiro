import type { EventoGamificacao, Transacao } from "./types";
import { resumoPorMes, resumoPorCategoria } from "./insights";

export const PONTOS = {
  NOTA_REGISTRADA: 10,
  IMPORTACAO: 15,
  TRANSACAO_IMPORTADA: 1,
  ITENS_IMPORTADOS: 5,
} as const;

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  conquistada: boolean;
}

export interface Desafio {
  categoria: string;
  alvo: number; // gasto máximo do mês para vencer
  gastoAtual: number;
  baseMedia: number; // média dos meses anteriores
  progresso: number; // 0..1 (quanto do orçamento já foi consumido)
  vencendo: boolean;
}

export interface EstadoGamificacao {
  pontos: number;
  nivel: number;
  pontosProximoNivel: number;
  titulo: string;
  conquistas: Conquista[];
  desafios: Desafio[];
  sequenciaMesesEmQueda: number;
}

const TITULOS = [
  "Aprendiz do Orçamento",
  "Caçador de Cupons",
  "Guardião da Carteira",
  "Estrategista Financeiro",
  "Mestre da Economia",
  "Lenda do Controle Total",
];

export function calcularEstado(
  eventos: EventoGamificacao[],
  transacoes: Transacao[],
  totalNotas: number
): EstadoGamificacao {
  const pontos = eventos.reduce((a, e) => a + e.pontos, 0);
  const nivel = Math.floor(pontos / 100) + 1;
  const titulo = TITULOS[Math.min(nivel - 1, TITULOS.length - 1)];

  const meses = resumoPorMes(transacoes);

  // Sequência de meses consecutivos com gasto menor que o anterior
  let sequencia = 0;
  for (let i = meses.length - 1; i > 0; i--) {
    if (meses[i].total < meses[i - 1].total) sequencia++;
    else break;
  }

  const conquistas: Conquista[] = [
    {
      id: "primeira-nota",
      nome: "Primeira Nota",
      descricao: "Registre sua primeira nota fiscal pelo QR Code",
      icone: "🧾",
      conquistada: totalNotas >= 1,
    },
    {
      id: "dez-notas",
      nome: "Colecionador",
      descricao: "Registre 10 notas fiscais",
      icone: "📚",
      conquistada: totalNotas >= 10,
    },
    {
      id: "primeira-importacao",
      nome: "Tudo Mapeado",
      descricao: "Importe sua primeira fatura (Excel ou PDF)",
      icone: "📥",
      conquistada: eventos.some((e) => e.tipo === "importacao"),
    },
    {
      id: "cem-transacoes",
      nome: "Visão de Raio-X",
      descricao: "Tenha 100 transações registradas",
      icone: "🔍",
      conquistada: transacoes.length >= 100,
    },
    {
      id: "mes-em-queda",
      nome: "Freio de Mão",
      descricao: "Feche um mês gastando menos que o anterior",
      icone: "📉",
      conquistada: sequencia >= 1,
    },
    {
      id: "tres-meses-queda",
      nome: "Disciplina de Ferro",
      descricao: "Reduza os gastos por 3 meses seguidos",
      icone: "🏆",
      conquistada: sequencia >= 3,
    },
    {
      id: "nivel-5",
      nome: "Mestre da Economia",
      descricao: "Alcance o nível 5",
      icone: "👑",
      conquistada: nivel >= 5,
    },
  ];

  return {
    pontos,
    nivel,
    pontosProximoNivel: nivel * 100,
    titulo,
    conquistas,
    desafios: calcularDesafios(transacoes),
    sequenciaMesesEmQueda: sequencia,
  };
}

/**
 * Desafios do mês: para cada categoria relevante, gastar 10% menos
 * que a média dos últimos 3 meses anteriores.
 */
export function calcularDesafios(transacoes: Transacao[]): Desafio[] {
  if (!transacoes.length) return [];
  const mesAtual = new Date().toISOString().slice(0, 7);

  const doMes = transacoes.filter((t) => t.data.slice(0, 7) === mesAtual);
  const anteriores = transacoes.filter((t) => t.data.slice(0, 7) < mesAtual);
  if (!anteriores.length) return [];

  const mesesAnteriores = [...new Set(anteriores.map((t) => t.data.slice(0, 7)))]
    .sort()
    .slice(-3);
  const base = anteriores.filter((t) => mesesAnteriores.includes(t.data.slice(0, 7)));

  const categoriasBase = resumoPorCategoria(base);
  const gastoAtualPorCat = new Map<string, number>();
  for (const t of doMes) {
    gastoAtualPorCat.set(
      t.categoria,
      (gastoAtualPorCat.get(t.categoria) ?? 0) + Number(t.valor)
    );
  }

  return categoriasBase
    .filter((c) => c.total / mesesAnteriores.length >= 50) // só categorias relevantes
    .slice(0, 5)
    .map((c) => {
      const media = c.total / mesesAnteriores.length;
      const alvo = Math.round(media * 0.9 * 100) / 100;
      const gastoAtual = Math.round((gastoAtualPorCat.get(c.categoria) ?? 0) * 100) / 100;
      return {
        categoria: c.categoria,
        alvo,
        gastoAtual,
        baseMedia: Math.round(media * 100) / 100,
        progresso: alvo > 0 ? Math.min(gastoAtual / alvo, 1.5) : 0,
        vencendo: gastoAtual <= alvo,
      };
    });
}
