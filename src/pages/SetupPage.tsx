import { getSupabaseConfigStatus } from "@/lib/supabase/client";

/** Affiché si .env incomplet — évite un crash opaque au démarrage. */
export function SetupPage() {
  const status = getSupabaseConfigStatus();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">SalisCRM</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Configuration requise</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          L’application est prête, mais la connexion Supabase n’est pas configurée localement.
        </p>

        {status.reason ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {status.reason}
          </p>
        ) : null}

        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-foreground/90">
          <li>
            Ouvrez le projet Supabase partagé avec <code className="text-xs">pro-extract-hub</code>{" "}
            (<span className="text-muted-foreground">(ref. agoupyllhisvheuxbyhe)</span>
          </li>
          <li>
            Copiez la clé <strong>publishable / anon</strong> (jamais la service_role)
          </li>
          <li>
            Dans <code className="text-xs">.env</code> :
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`VITE_SUPABASE_URL=https://agoupyllhisvheuxbyhe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_publishable`}
            </pre>
          </li>
          <li>
            Appliquez les migrations SQL du dossier <code className="text-xs">supabase/migrations</code>{" "}
            (SQL Editor ou <code className="text-xs">npx supabase db push</code>)
          </li>
          <li>
            Créez un admin :
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`insert into public.staff_profiles (user_id, role, display_name)
values ('<auth.users.id>', 'admin', 'Direction');`}
            </pre>
          </li>
          <li>Relancez <code className="text-xs">npm run dev</code></li>
        </ol>

        {status.missing.length > 0 ? (
          <p className="mt-6 text-xs text-muted-foreground">
            Variables manquantes : {status.missing.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
