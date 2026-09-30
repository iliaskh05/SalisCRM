import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qrCode: string; secret: string };

/** Activation de la double authentification (application TOTP : Google Authenticator, Authy, 1Password…). */
export function AccountSecurityPage() {
  const qc = useQueryClient();
  const { user, mfaEnrollmentRequired, refreshMfaState } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [toRemove, setToRemove] = useState<string | null>(null);

  const factorsQuery = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });
  const verified = factorsQuery.data?.totp ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["mfa-factors"] });

  const start = useMutation({
    mutationFn: async () => {
      // Une activation abandonnée laisse un facteur non vérifié qui bloquerait la suivante
      for (const f of (factorsQuery.data?.all ?? []).filter((x) => x.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Application d’authentification" });
      if (error) throw error;
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    },
    onSuccess: (e) => {
      setEnrollment(e);
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!enrollment) return;
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
      if (error) throw new Error("Code incorrect ou expiré. Vérifiez l’heure de votre téléphone.");
    },
    onSuccess: async () => {
      toast.success("Double authentification activée");
      setEnrollment(null);
      setCode("");
      await refresh();
      await refreshMfaState();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Double authentification désactivée");
      setToRemove(null);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (factorsQuery.isLoading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Sécurité du compte" description={user?.email ?? undefined} />
      {mfaEnrollmentRequired && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          La direction exige la double authentification pour les administrateurs. Activez-la ci-dessous pour retrouver l’accès à
          l’application.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {verified.length > 0 ? <ShieldCheck className="size-4 text-emerald-600" /> : <ShieldOff className="size-4 text-muted-foreground" />}
            Double authentification
          </CardTitle>
          <CardDescription>
            À chaque connexion, un code à 6 chiffres généré par votre téléphone s’ajoute au mot de passe. Même si votre mot
            de passe est volé, personne ne peut accéder aux données sans votre téléphone. Recommandé pour tous, indispensable
            pour la direction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verified.length > 0 && !enrollment && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {verified.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{f.friendly_name ?? "Application d’authentification"}</p>
                    <p className="text-xs text-muted-foreground">Activée le {formatDate(f.created_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setToRemove(f.id)}>
                    Désactiver
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {verified.length === 0 && !enrollment && (
            <Button variant="accent" disabled={start.isPending} onClick={() => start.mutate()}>
              Activer la double authentification
            </Button>
          )}

          {enrollment && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                confirm.mutate();
              }}
            >
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Installez une application d’authentification sur votre téléphone (Google Authenticator, Authy, 1Password…).</li>
                <li>Scannez ce QR code, ou saisissez la clé manuellement.</li>
                <li>Saisissez le code à 6 chiffres affiché pour terminer.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-4">
                <img src={enrollment.qrCode} alt="QR code à scanner avec l’application d’authentification" className="size-40 rounded-lg border border-border bg-white p-2" />
                <div className="min-w-0 text-xs">
                  <p className="text-muted-foreground">Clé de configuration manuelle</p>
                  <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-sm">{enrollment.secret}</code>
                </div>
              </div>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="enroll-code">Code de vérification</Label>
                <Input
                  id="enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="accent" disabled={confirm.isPending || code.length !== 6}>
                  Activer
                </Button>
                <Button type="button" variant="outline" onClick={() => setEnrollment(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) remove.mutate(toRemove);
        }}
        title="Désactiver la double authentification ?"
        description="Votre compte ne sera plus protégé que par son mot de passe."
        confirmLabel="Désactiver"
        loading={remove.isPending}
        destructive
      />
    </div>
  );
}
