"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CORES_CATEGORIAS } from "@/lib/categorize";
import type { ItemNota } from "@/lib/types";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORIAS = Object.keys(CORES_CATEGORIAS);

function LinhaEditavel({ item }: { item: ItemNota }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [desc, setDesc] = useState(item.descricao);
  const [categoria, setCategoria] = useState(item.categoria);
  const [qtd, setQtd] = useState(String(item.quantidade).replace(".", ","));
  const [total, setTotal] = useState(String(item.valor_total).replace(".", ","));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setOcupado(true);
    setErro(null);
    const quantidade = parseFloat(qtd.replace(/\./g, "").replace(",", "."));
    const valor_total = parseFloat(total.replace(/\./g, "").replace(",", "."));
    if (!desc.trim() || !(quantidade > 0) || !(valor_total > 0)) {
      setErro("Preencha descrição, quantidade e valor válidos.");
      setOcupado(false);
      return;
    }
    try {
      const resp = await fetch(`/api/itens/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: desc, categoria, quantidade, valor_total }),
      });
      const json = await resp.json();
      if (!resp.ok) setErro(json.erro ?? "Falha ao salvar.");
      else {
        setEditando(false);
        router.refresh();
      }
    } catch {
      setErro("Erro de rede ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o item "${item.descricao}"?`)) return;
    setOcupado(true);
    try {
      const resp = await fetch(`/api/itens/${item.id}`, { method: "DELETE" });
      if (resp.ok) router.refresh();
      else setErro("Falha ao excluir.");
    } catch {
      setErro("Erro de rede ao excluir.");
    } finally {
      setOcupado(false);
    }
  }

  if (!editando) {
    return (
      <tr>
        <td>{item.descricao}</td>
        <td><span className="badge">{item.categoria}</span></td>
        <td className="num">{item.quantidade}</td>
        <td className="num">{fmt(item.valor_total)}</td>
        <td className="num" style={{ whiteSpace: "nowrap" }}>
          <button
            className="btn btn-secundario btn-mini"
            disabled={ocupado}
            onClick={() => setEditando(true)}
            title="Editar item"
          >
            ✏️
          </button>{" "}
          <button
            className="btn btn-perigo btn-mini"
            disabled={ocupado}
            onClick={excluir}
            title="Excluir item"
          >
            🗑️
          </button>
          {erro && <div className="msg-erro" style={{ fontSize: 12 }}>{erro}</div>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </td>
      <td>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="select-categoria"
        >
          {!CATEGORIAS.includes(categoria) && <option value={categoria}>{categoria}</option>}
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="text"
          inputMode="decimal"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          style={{ width: 70 }}
        />
      </td>
      <td>
        <input
          type="text"
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          style={{ width: 100 }}
        />
      </td>
      <td className="num" style={{ whiteSpace: "nowrap" }}>
        <button className="btn btn-mini" disabled={ocupado} onClick={salvar} title="Salvar">
          {ocupado ? "..." : "💾"}
        </button>{" "}
        <button
          className="btn btn-secundario btn-mini"
          disabled={ocupado}
          onClick={() => {
            setEditando(false);
            setErro(null);
          }}
          title="Cancelar"
        >
          ✖
        </button>
        {erro && <div className="msg-erro" style={{ fontSize: 12 }}>{erro}</div>}
      </td>
    </tr>
  );
}

export default function ItensEditaveis({ itens }: { itens: ItemNota[] }) {
  if (!itens.length) return null;
  return (
    <div className="tabela-scroll">
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Categoria</th>
            <th className="num">Qtd</th>
            <th className="num">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <LinhaEditavel key={i.id} item={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
