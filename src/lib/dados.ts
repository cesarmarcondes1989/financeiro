import { getSupabase } from "./supabase";
import type { EventoGamificacao, ItemNota, NotaFiscal, Transacao } from "./types";
import type { TransacaoImportada } from "./parsers/excel";

export async function listarTransacoes(mes?: string): Promise<Transacao[]> {
  let query = getSupabase()
    .from("transacoes")
    .select("*")
    .order("data", { ascending: false })
    .limit(5000);
  if (mes) {
    // Filtra pelo mês YYYY-MM: data >= primeiro dia, <= último dia possível
    query = query.gte("data", `${mes}-01`).lte("data", `${mes}-31`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Erro ao listar transações: ${error.message}`);
  return (data ?? []).map((t) => ({ ...t, valor: Number(t.valor) }));
}

export async function inserirTransacoes(
  transacoes: TransacaoImportada[],
  origem: "excel" | "pdf" | "nfce" | "manual"
): Promise<number> {
  if (!transacoes.length) return 0;
  const { data, error } = await getSupabase()
    .from("transacoes")
    .upsert(
      transacoes.map((t) => ({ ...t, origem })),
      { onConflict: "data,descricao,valor", ignoreDuplicates: true }
    )
    .select("id");
  if (error) throw new Error(`Erro ao inserir transações: ${error.message}`);
  return data?.length ?? 0;
}

export async function listarNotas(filtro?: { municipio?: string; mes?: string }): Promise<NotaFiscal[]> {
  let query = getSupabase()
    .from("notas_fiscais")
    .select("*")
    .order("criado_em", { ascending: false });
  if (filtro?.municipio) query = query.eq("municipio", filtro.municipio);
  if (filtro?.mes) {
    query = query
      .gte("data_emissao", `${filtro.mes}-01`)
      .lte("data_emissao", `${filtro.mes}-31T23:59:59`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Erro ao listar notas: ${error.message}`);
  return (data ?? []).map((n) => ({
    ...n,
    valor_total: n.valor_total === null ? null : Number(n.valor_total),
  }));
}

export async function listarMunicipios(): Promise<string[]> {
  const { data } = await getSupabase()
    .from("notas_fiscais")
    .select("municipio")
    .not("municipio", "is", null)
    .order("municipio");
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (row.municipio) seen.add(row.municipio as string);
  }
  return [...seen];
}

export async function buscarNota(id: string): Promise<{ nota: NotaFiscal; itens: ItemNota[] } | null> {
  const sb = getSupabase();
  const { data: nota, error } = await sb
    .from("notas_fiscais")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!nota) return null;
  const { data: itens, error: e2 } = await sb
    .from("itens_nota")
    .select("*")
    .eq("nota_id", id)
    .order("descricao");
  if (e2) throw new Error(e2.message);
  return {
    nota: { ...nota, valor_total: nota.valor_total === null ? null : Number(nota.valor_total) },
    itens: (itens ?? []).map((i) => ({
      ...i,
      quantidade: Number(i.quantidade),
      valor_unitario: i.valor_unitario === null ? null : Number(i.valor_unitario),
      valor_total: Number(i.valor_total),
    })),
  };
}

export async function inserirNota(nota: Omit<NotaFiscal, "id">): Promise<{ nota: NotaFiscal; jaExistia: boolean }> {
  const sb = getSupabase();
  const { data: existente } = await sb
    .from("notas_fiscais")
    .select("*")
    .eq("chave_acesso", nota.chave_acesso)
    .maybeSingle();
  if (existente) return { nota: existente as NotaFiscal, jaExistia: true };

  const { data, error } = await sb.from("notas_fiscais").insert(nota).select().single();
  if (error) throw new Error(`Erro ao inserir nota: ${error.message}`);
  return { nota: data as NotaFiscal, jaExistia: false };
}

export async function inserirItensNota(
  notaId: string,
  itens: Array<Omit<ItemNota, "id" | "nota_id">>
): Promise<number> {
  if (!itens.length) return 0;
  const { data, error } = await getSupabase()
    .from("itens_nota")
    .insert(itens.map((i) => ({ ...i, nota_id: notaId })))
    .select("id");
  if (error) throw new Error(`Erro ao inserir itens: ${error.message}`);
  return data?.length ?? 0;
}

/** Atualiza campos da nota. Tolera colunas opcionais ainda não criadas por migração. */
export async function atualizarNota(id: string, campos: Partial<NotaFiscal>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("notas_fiscais").update(campos).eq("id", id);
  if (!error) return;

  // Se o erro menciona uma coluna opcional (adicionada por migração), remove-a e tenta de novo
  const opcionais = ["emitente_nome", "municipio"];
  const faltando = opcionais.filter((c) => c in campos && error.message.includes(c));
  if (faltando.length > 0) {
    const resto = Object.fromEntries(Object.entries(campos).filter(([k]) => !faltando.includes(k)));
    if (Object.keys(resto).length === 0) return;
    const { error: e2 } = await sb.from("notas_fiscais").update(resto).eq("id", id);
    if (e2) throw new Error(`Erro ao atualizar nota: ${e2.message}`);
    return;
  }
  throw new Error(`Erro ao atualizar nota: ${error.message}`);
}

export async function contarItensNota(notaId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("itens_nota")
    .select("id", { count: "exact", head: true })
    .eq("nota_id", notaId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Quantidade de itens lançados por nota (para a listagem). */
export async function contarItensPorNota(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase()
    .from("itens_nota")
    .select("nota_id")
    .limit(20000);
  if (error) throw new Error(error.message);
  const contagem: Record<string, number> = {};
  for (const linha of data ?? []) {
    contagem[linha.nota_id] = (contagem[linha.nota_id] ?? 0) + 1;
  }
  return contagem;
}

/**
 * Exclui a nota (itens caem em cascata) e o gasto lançado a partir dela
 * (transação de origem nfce com mesma data e valor), se houver.
 */
export async function excluirNota(id: string): Promise<void> {
  const sb = getSupabase();
  const { data: nota } = await sb
    .from("notas_fiscais")
    .select("valor_total, data_emissao")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb.from("notas_fiscais").delete().eq("id", id);
  if (error) throw new Error(`Erro ao excluir nota: ${error.message}`);

  if (nota?.valor_total != null && nota?.data_emissao) {
    await sb
      .from("transacoes")
      .delete()
      .eq("origem", "nfce")
      .eq("valor", nota.valor_total)
      .eq("data", String(nota.data_emissao).slice(0, 10));
  }
}

export async function atualizarItem(
  id: string,
  campos: Partial<Pick<ItemNota, "descricao" | "quantidade" | "valor_unitario" | "valor_total" | "categoria">>
): Promise<void> {
  const { error } = await getSupabase().from("itens_nota").update(campos).eq("id", id);
  if (error) throw new Error(`Erro ao atualizar item: ${error.message}`);
}

export async function excluirItem(id: string): Promise<void> {
  const { error } = await getSupabase().from("itens_nota").delete().eq("id", id);
  if (error) throw new Error(`Erro ao excluir item: ${error.message}`);
}

export async function listarEventos(): Promise<EventoGamificacao[]> {
  const { data, error } = await getSupabase()
    .from("eventos_gamificacao")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Erro ao listar eventos: ${error.message}`);
  return data ?? [];
}

export async function registrarEvento(tipo: string, pontos: number, descricao?: string): Promise<void> {
  const { error } = await getSupabase()
    .from("eventos_gamificacao")
    .insert({ tipo, pontos, descricao });
  if (error) throw new Error(`Erro ao registrar evento: ${error.message}`);
}

export async function contarNotas(): Promise<number> {
  const { count, error } = await getSupabase()
    .from("notas_fiscais")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Transações não-NFC-e (manual, excel, pdf) com filtro opcional de mês. */
export async function listarTransacoesNaoNfce(mes?: string): Promise<Transacao[]> {
  let query = getSupabase()
    .from("transacoes")
    .select("*")
    .neq("origem", "nfce")
    .order("data", { ascending: false })
    .limit(5000);
  if (mes) {
    query = query.gte("data", `${mes}-01`).lte("data", `${mes}-31`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Erro ao listar transações: ${error.message}`);
  return (data ?? []).map((t) => ({ ...t, valor: Number(t.valor) }));
}

/** Itens de nota com dados do estabelecimento (para análise de preços). */
export async function listarItensComEstabelecimento(): Promise<Array<{
  descricao: string;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number;
  categoria: string;
  emitente_nome: string | null;
  municipio: string | null;
  data_emissao: string | null;
}>> {
  const sb = getSupabase();
  const { data: itens, error } = await sb
    .from("itens_nota")
    .select("nota_id, descricao, quantidade, valor_unitario, valor_total, categoria")
    .limit(10000);
  if (error) throw new Error(error.message);
  if (!itens?.length) return [];

  const notaIds = [...new Set(itens.map((i) => i.nota_id as string))];
  const notasMap: Record<string, { emitente_nome: string | null; municipio: string | null; data_emissao: string | null }> = {};
  for (let i = 0; i < notaIds.length; i += 500) {
    const lote = notaIds.slice(i, i + 500);

    // Tenta select completo; se falhar por coluna inexistente (migração pendente),
    // retenta apenas com as colunas obrigatórias.
    let { data: notas, error: errNotas } = await sb
      .from("notas_fiscais")
      .select("id, emitente_nome, municipio, data_emissao")
      .in("id", lote);

    if (errNotas) {
      const r2 = await sb
        .from("notas_fiscais")
        .select("id, emitente_nome, data_emissao")
        .in("id", lote);
      notas = r2.data as typeof notas;
    }

    for (const n of notas ?? []) {
      notasMap[n.id as string] = {
        emitente_nome: (n.emitente_nome as string | null) ?? null,
        municipio: (n as Record<string, unknown>).municipio as string | null ?? null,
        data_emissao: (n.data_emissao as string | null) ?? null,
      };
    }
  }

  return itens.map((i) => ({
    descricao: i.descricao as string,
    quantidade: Number(i.quantidade),
    valor_unitario: i.valor_unitario === null ? null : Number(i.valor_unitario),
    valor_total: Number(i.valor_total),
    categoria: i.categoria as string,
    ...(notasMap[i.nota_id as string] ?? { emitente_nome: null, municipio: null, data_emissao: null }),
  }));
}

/** Transações dos últimos N meses, para análise de tendências. */
export async function listarTransacoesHistorico(meses: number = 5): Promise<Array<{ data: string; categoria: string; valor: number }>> {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);
  const { data, error } = await getSupabase()
    .from("transacoes")
    .select("data, categoria, valor")
    .gte("data", desde.toISOString().slice(0, 10))
    .order("data", { ascending: true })
    .limit(50000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    data: t.data as string,
    categoria: t.categoria as string,
    valor: Number(t.valor),
  }));
}
