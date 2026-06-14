"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "🏠", label: "Início", exact: true },
  { href: "/gastos", icon: "💸", label: "Gastos", exact: false },
  { href: "/notas/scanner", icon: "📷", label: "Scanner", exact: true },
  { href: "/upload", icon: "➕", label: "Importar", exact: false },
  { href: "/analise", icon: "📊", label: "Análise", exact: false },
];

export default function NavInferior() {
  const path = usePathname();

  return (
    <nav className="nav-bottom">
      {TABS.map(({ href, icon, label, exact }) => {
        const ativo = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`nav-item${ativo ? " ativo" : ""}`}>
            <span className="nav-icone">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
