"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { CORES_CATEGORIAS } from "@/lib/categorize";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function GraficoMensal({ dados }: { dados: Array<{ mes: string; total: number }> }) {
  if (!dados.length) return <p style={{ color: "var(--text-dim)" }}>Sem dados ainda.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={dados}>
        <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R$${Math.round(v)}`} width={70} />
        <Tooltip
          formatter={(v) => fmtBRL(Number(v))}
          contentStyle={{ background: "#141b2e", border: "1px solid #232d47", borderRadius: 8 }}
          labelStyle={{ color: "#e7ecf5" }}
        />
        <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Total" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoCategorias({
  dados,
}: {
  dados: Array<{ categoria: string; total: number }>;
}) {
  if (!dados.length) return <p style={{ color: "var(--text-dim)" }}>Sem dados ainda.</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="total"
          nameKey="categoria"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
        >
          {dados.map((d) => (
            <Cell key={d.categoria} fill={CORES_CATEGORIAS[d.categoria] ?? "#64748b"} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => fmtBRL(Number(v))}
          contentStyle={{ background: "#141b2e", border: "1px solid #232d47", borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
