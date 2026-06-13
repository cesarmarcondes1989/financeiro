export interface Transacao {
  id: string;
  data: string; // YYYY-MM-DD
  descricao: string;
  valor: number;
  categoria: string;
  origem: "excel" | "pdf" | "nfce" | "manual";
  cartao?: string | null;
  parcela?: string | null;
  criado_em?: string;
}

export interface NotaFiscal {
  id: string;
  chave_acesso: string;
  url_consulta?: string | null;
  emitente_cnpj?: string | null;
  emitente_nome?: string | null;
  municipio?: string | null;
  numero?: string | null;
  serie?: string | null;
  uf?: string | null;
  data_emissao?: string | null;
  valor_total?: number | null;
  criado_em?: string;
}

export interface ItemNota {
  id: string;
  nota_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario?: number | null;
  valor_total: number;
  categoria: string;
}

export interface EventoGamificacao {
  id: string;
  tipo: string;
  pontos: number;
  descricao?: string | null;
  criado_em: string;
}

export interface Meta {
  id: string;
  categoria: string;
  limite_mensal: number;
}
