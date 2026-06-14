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
    <div className="chips">
      <button
        className={`chip${!atual ? " ativo" : ""}`}
        onClick={() => router.push("/notas")}
      >
        Todas
      </button>
      {municipios.map((m) => (
        <button
          key={m}
          className={`chip${atual === m ? " ativo" : ""}`}
          onClick={() => router.push(`/notas?municipio=${encodeURIComponent(m)}`)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
