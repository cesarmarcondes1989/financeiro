"use client";

import { useRouter } from "next/navigation";

export default function FiltroMes({ meses, atual, base }: { meses: string[]; atual?: string; base: string }) {
  const router = useRouter();
  const ir = (mes: string) =>
    router.push(mes ? `${base}?mes=${mes}` : base);

  if (!meses.length) return null;

  return (
    <div className="chips">
      <button
        className={`chip${!atual ? " ativo" : ""}`}
        onClick={() => ir("")}
      >
        Todos
      </button>
      {meses.map((m) => {
        const [ano, mo] = m.split("-");
        const label = new Date(Number(ano), Number(mo) - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        return (
          <button
            key={m}
            className={`chip${atual === m ? " ativo" : ""}`}
            onClick={() => ir(m)}
          >
            {label.replace(".", "")}
          </button>
        );
      })}
    </div>
  );
}
