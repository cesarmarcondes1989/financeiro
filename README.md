# 💰 Financeiro — Controle de Gastos de Cartão

Sistema financeiro pessoal para analisar gastos de cartão de crédito, registrar
notas fiscais (NFC-e) pela foto do QR Code, armazenar tudo no Supabase e reduzir
custos com análises, sugestões e gamificação.

## Funcionalidades

- **📷 Foto do QR Code (NFC-e)** — o QR é lido no próprio aparelho
  (BarcodeDetector nativo) com fallback no servidor; o app registra a nota e
  **consulta o portal da SEFAZ** para importar automaticamente o nome do
  estabelecimento, data, valor total e todos os itens do cupom. Também é
  possível digitar a chave de acesso de 44 dígitos (validada pelo dígito
  verificador) quando o QR não puder ser lido.
- **📊 Upload de Excel/CSV** — importa faturas exportadas do app do banco
  (detecta automaticamente as colunas de data, descrição e valor).
- **📄 Upload de PDF** — extrai transações de PDFs de fatura (Nubank, Itaú,
  Bradesco, Santander, C6, Inter e formatos similares).
- **🏷️ Categorização automática** — iFood → Alimentação, Uber → Transporte,
  Netflix → Assinaturas etc.
- **📈 Dashboard de análise** — gastos por mês, por categoria, top
  estabelecimentos e detecção de assinaturas recorrentes.
- **💡 Sugestões de economia** — alertas de crescimento de gastos, categorias
  dominantes, excesso de delivery, parcelamentos acumulados, com estimativa de
  economia potencial.
- **🎮 Gamificação** — pontos por registrar notas e importar faturas, níveis,
  conquistas e desafios mensais de gastar 10% menos que a sua média.

## Stack

- [Next.js 15](https://nextjs.org) (App Router, TypeScript)
- [Supabase](https://supabase.com) (Postgres)
- `sharp` + `jsqr` (leitura de QR Code em fotos), `xlsx` (Excel), `pdf-parse` (PDF), `recharts` (gráficos)

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Settings → API**, copie a **Project URL** e a **service_role key**.

### 2. Desenvolvimento local

```bash
cp .env.example .env.local   # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Acesse http://localhost:3000.

### 3. Deploy na Vercel

1. Importe o repositório em [vercel.com/new](https://vercel.com/new).
2. Em **Environment Variables**, adicione:
   - `SUPABASE_URL` — a Project URL do Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` — a service_role key
3. Deploy. ✅

> **Segurança:** a service_role key só é usada em código de servidor (API
> routes e Server Components) e nunca chega ao navegador. As tabelas têm RLS
> habilitado sem policies públicas, então a anon key não acessa nada.

## Formato esperado do Excel

Qualquer planilha com colunas reconhecíveis de **data**, **descrição** e
**valor** (nomes flexíveis: `Data`, `Date`, `Descrição`, `Estabelecimento`,
`Lançamento`, `Valor`, `Amount`...). Colunas opcionais: `Categoria`, `Cartão`,
`Parcela`. Valores em formato brasileiro (`1.234,56`) ou internacional.

## Limitações conhecidas / próximos passos

- A importação automática dos itens usa a página pública apontada pelo QR Code
  (layout nacional de DANFE NFC-e, adotado pela maioria dos estados). Estados
  com layout próprio podem não ser reconhecidos — nesse caso use o botão
  "Buscar itens na SEFAZ" mais tarde ou lance os itens manualmente. Notas
  registradas só pela chave digitada não têm a URL autenticada do QR, então a
  consulta automática não se aplica (limitação dos portais, que exigem captcha).
- PDFs de fatura muito fora dos formatos comuns podem não ser reconhecidos —
  nesses casos, exporte como Excel/CSV.
- Possíveis evoluções: OCR de cupons sem QR Code, metas personalizadas por
  categoria, login multiusuário (Supabase Auth), notificações.
