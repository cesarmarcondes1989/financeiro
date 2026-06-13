"use client";

import { useRouter } from "next/navigation";

export default function FiltroMunicipio({
  municipios,
  atual,
}: {
  municipios: string[];
  atual?: string;
}) {
  const router = useRouter();

  if (!municipios.length) return null;

  return (
    <select
      value={atual ?? ""}
      onChange={(e) =>
        router.push(
          e.target.value
            ? `/notas?municipio=${encodeURIComponent(e.target.value)}`
            : "/notas"
        )
      }
      className="select-categoria"
      style={{ width: "auto", minWidth: 200 }}
      aria-label="Filtrar por município"
    >
      <option value="">Todos os municípios</option>
      {municipios.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
