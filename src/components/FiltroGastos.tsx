"use client";

import { useRouter } from "next/navigation";

export default function FiltroGastos({
  meses,
  mesAtual,
  tipoAtual,
}: {
  meses: string[];
  mesAtual?: string;
  tipoAtual?: string;
}) {
  const router = useRouter();

  function ir(mes: string | undefined, tipo: string | undefined) {
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    if (tipo) params.set("tipo", tipo);
    const qs = params.toString();
    router.push(`/gastos${qs ? "?" + qs : ""}`);
  }

  return (
    <>
      <div className="chips">
        <button
          className={`chip${!mesAtual ? " ativo" : ""}`}
          onClick={() => ir(undefined, tipoAtual)}
        >
          Todos
        </button>
        {meses.map((m) => {
          const [ano, mo] = m.split("-");
          const label = new Date(Number(ano), Number(mo) - 1).toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          });
          return (
            <button
              key={m}
              className={`chip${mesAtual === m ? " ativo" : ""}`}
              onClick={() => ir(m, tipoAtual)}
            >
              {label.replace(".", "")}
            </button>
          );
        })}
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {(["", "nota", "manual"] as string[]).map((t) => (
          <button
            key={t || "todos"}
            className={`chip${(tipoAtual ?? "") === t ? " ativo" : ""}`}
            onClick={() => ir(mesAtual, t || undefined)}
          >
            {t === "" ? "Todos" : t === "nota" ? "🧾 Notas" : "✏️ Manual"}
          </button>
        ))}
      </div>
    </>
  );
}
