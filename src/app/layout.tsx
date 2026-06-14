import type { Metadata, Viewport } from "next";
import NavInferior from "@/components/NavInferior";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financeiro",
  description: "Controle de gastos pessoais com NFC-e, cartão e gamificação",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="container">{children}</main>
        <NavInferior />
      </body>
    </html>
  );
}
