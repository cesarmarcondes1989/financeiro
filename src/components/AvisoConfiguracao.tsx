export default function AvisoConfiguracao() {
  return (
    <div className="aviso-config">
      <strong>⚙️ Supabase ainda não configurado</strong>
      <ol>
        <li>Crie um projeto em <code>supabase.com</code></li>
        <li>No SQL Editor, execute o conteúdo de <code>supabase/schema.sql</code></li>
        <li>
          Defina as variáveis de ambiente <code>SUPABASE_URL</code> e{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> (em <code>.env.local</code> no
          desenvolvimento ou em Settings → Environment Variables na Vercel)
        </li>
        <li>Reinicie o servidor / faça redeploy</li>
      </ol>
    </div>
  );
}
