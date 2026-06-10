import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financeiro — Controle de Gastos",
  description:
    "Análise de gastos de cartão de crédito, notas fiscais via QR Code e gamificação para economizar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="nav-logo">
              💰 <span>Financeiro</span>
            </Link>
            <Link href="/" className="nav-link">Dashboard</Link>
            <Link href="/upload" className="nav-link">Importar</Link>
            <Link href="/transacoes" className="nav-link">Transações</Link>
            <Link href="/notas" className="nav-link">Notas Fiscais</Link>
            <Link href="/gamificacao" className="nav-link">Gamificação</Link>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
