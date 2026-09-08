import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useDemoStore } from "@/lib/demo/store";
import type { DemoRole } from "@/lib/demo/types";

export function DemoLoginPage() {
  const { currentUser, login } = useDemoStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("sophie@salis3hottes.fr");
  const [password, setPassword] = useState("demo2026");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;

  return (
    <AuthFrame>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Connexion</h1>
      <p className="mt-2 text-sm text-muted-foreground">Espace interne — direction & prestataires</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          const error = login(email, password, remember);
          setBusy(false);
          if (error) {
            toast.error(error);
            return;
          }
          toast.success("Bienvenue sur SalisCRM");
          navigate("/");
        }}
      >
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </Field>
        <Field label="Mot de passe">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Mémoriser la session
        </label>
        <Button type="submit" className="w-full" variant="accent" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </Button>
        <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => toast.message("Mode démo", { description: "Réinitialisez le mot de passe depuis Paramètres. Compte direction : sophie@salis3hottes.fr / demo2026" })}>
          Mot de passe oublié
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Pas encore de compte ? <Link to="/register" className="font-medium text-teal-700">Demander un accès</Link>
      </p>
      <div className="mt-5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Direction : sophie@salis3hottes.fr · Commercial : wael@salis3hottes.fr · Prestataire : karim@salis3hottes.fr · mot de passe demo2026
      </div>
    </AuthFrame>
  );
}

export function DemoRegisterPage() {
  const { register } = useDemoStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<DemoRole>("prestataire");
  const [done, setDone] = useState(false);

  return (
    <AuthFrame>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Demande d’accès</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Un compte ne devient jamais administrateur tout seul. La direction valide et assigne le rôle.
      </p>
      {done ? (
        <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          Demande enregistrée. Statut : <b>en attente d’approbation</b>. Vous pourrez vous connecter après validation.
          <Button className="mt-4 w-full" onClick={() => navigate("/login")}>
            Retour à la connexion
          </Button>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const error = register({ name, email, password, requestedRole });
            if (error) {
              toast.error(error);
              return;
            }
            setDone(true);
          }}
        >
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </Field>
          <Field label="Mot de passe">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required />
          </Field>
          <Field label="Type de compte demandé">
            <Select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as DemoRole)}>
              <option value="prestataire">Prestataire</option>
              <option value="commercial">Commercial</option>
              <option value="admin">Direction / gestion</option>
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">Le rôle demandé n’est pas appliqué tant que la direction n’a pas approuvé le compte.</p>
          <Button type="submit" variant="accent" className="w-full">
            Envoyer la demande
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link to="/login" className="text-teal-700">Retour</Link>
      </p>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.02_205),_var(--background)_55%)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[0_20px_50px_-28px_oklch(0.2_0.03_250/0.45)]">
        <BrandLogo size="xl" align="center" className="mb-1" />
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
