import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";

/** Rend la double authentification obligatoire pour les administrateurs (désactivée par défaut). */
export function SecurityPolicyCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const policy = useQuery({
    queryKey: ["security-policy"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("security_policy");
      if (error) throw error;
      return data;
    },
  });

  const staff = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_staff_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const myFactors = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const enabled = policy.data?.require_admin_mfa === true;
  const iHaveMfa = (myFactors.data?.totp?.length ?? 0) > 0;
  const exposed = (staff.data ?? []).filter((s) => s.role === "admin" && !s.mfa_enabled && s.user_id !== user?.id);

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.rpc("set_require_admin_mfa", { p_enabled: next });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(enabled ? "Double authentification non obligatoire" : "Double authentification obligatoire pour la direction");
      setConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: ["security-policy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Double authentification de la direction
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Obligatoire" : "Facultative"}</Badge>
        </CardTitle>
        <CardDescription>
          Quand elle est obligatoire, un administrateur sans double authentification n’a plus accès à rien (données, paramètres)
          jusqu’à ce qu’il l’active : il est redirigé vers « Sécurité du compte ». Recommandé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!enabled && !iHaveMfa && !myFactors.isLoading && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
            Activez d’abord la double authentification sur <b>votre</b> compte pour pouvoir l’imposer aux autres :{" "}
            <Link to="/securite" className="font-medium underline">
              Sécurité du compte
            </Link>
            .
          </p>
        )}
        {!enabled && exposed.length > 0 && (
          <p className="text-muted-foreground">
            {exposed.length} autre(s) administrateur(s) n’ont pas encore activé la double authentification et seraient bloqués
            jusqu’à son activation : {exposed.map((s) => s.display_name || s.email).join(", ")}.
          </p>
        )}
        <Button
          variant={enabled ? "outline" : "accent"}
          disabled={toggle.isPending || policy.isLoading || (!enabled && !iHaveMfa)}
          onClick={() => (enabled ? toggle.mutate(false) : setConfirmOpen(true))}
        >
          {enabled ? "Rendre facultative" : "Rendre obligatoire"}
        </Button>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => toggle.mutate(true)}
        title="Rendre la double authentification obligatoire ?"
        description={
          exposed.length > 0
            ? `${exposed.length} administrateur(s) sans double authentification perdront l’accès tant qu’ils ne l’auront pas activée (${exposed.map((s) => s.display_name || s.email).join(", ")}). Prévenez-les avant.`
            : "Tous les administrateurs ont déjà activé la double authentification."
        }
        confirmLabel="Rendre obligatoire"
        loading={toggle.isPending}
      />
    </Card>
  );
}
