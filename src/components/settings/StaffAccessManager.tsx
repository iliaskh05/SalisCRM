import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { Select } from "@/components/ui/select";
import { TableShell, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { edgeFunctionError } from "@/lib/supabase/edge";
import type { Database, StaffRole } from "@/lib/supabase/types";

type StaffUser = Database["public"]["Functions"]["list_staff_users"]["Returns"][number];

type InviteForm = {
  /** Renseigné quand on traite une demande existante : pas d'e-mail d'invitation. */
  userId: string | null;
  email: string;
  displayName: string;
  role: StaffRole;
  providerId: string;
};

const emptyForm: InviteForm = { userId: null, email: "", displayName: "", role: "commercial", providerId: "" };

export function StaffAccessManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<InviteForm>(emptyForm);
  const [toRevoke, setToRevoke] = useState<StaffUser | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_staff_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_access_requests");
      if (error) throw error;
      return data ?? [];
    },
  });

  const providersQuery = useQuery({
    queryKey: ["providers-for-access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("id, name, user_id, status")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["staff-users"] });
    await qc.invalidateQueries({ queryKey: ["access-requests"] });
    await qc.invalidateQueries({ queryKey: ["providers-for-access"] });
  };

  const submit = useMutation({
    mutationFn: async () => {
      const providerId = form.role === "prestataire" ? form.providerId || null : null;
      if (form.role === "prestataire" && !providerId) {
        throw new Error("Choisissez la fiche prestataire à associer.");
      }

      if (form.userId) {
        const { error } = await supabase.rpc("grant_staff_access", {
          p_user_id: form.userId,
          p_role: form.role,
          p_display_name: form.displayName.trim() || null,
          p_provider_id: providerId,
        });
        if (error) throw error;
        return { invited: false };
      }

      const { data, error } = await supabase.functions.invoke<{ invited: boolean }>("invite-staff", {
        body: {
          email: form.email.trim(),
          display_name: form.displayName.trim(),
          role: form.role,
          provider_id: providerId,
          redirect_to: `${window.location.origin}/definir-mot-de-passe`,
        },
      });
      if (error) throw new Error(await edgeFunctionError(error));
      return { invited: Boolean(data?.invited) };
    },
    onSuccess: async ({ invited }) => {
      toast.success(invited ? "Invitation envoyée par e-mail" : "Accès accordé");
      setForm(emptyForm);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: async ({ member, role }: { member: StaffUser; role: StaffRole }) => {
      const { error } = await supabase.rpc("grant_staff_access", {
        p_user_id: member.user_id,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Rôle mis à jour");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (member: StaffUser) => {
      const { error } = await supabase.rpc("revoke_staff_access", { p_user_id: member.user_id });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Accès retiré");
      setToRevoke(null);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const freeProviders = (providersQuery.data ?? []).filter(
    (p) => p.status === "active" && (!p.user_id || p.user_id === form.userId),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{form.userId ? "Traiter la demande d’accès" : "Inviter un membre"}</CardTitle>
          <CardDescription>
            {form.userId
              ? "Le compte existe déjà : l’accès est accordé immédiatement, sans nouvel e-mail."
              : "Un e-mail d’invitation est envoyé ; la personne choisit son mot de passe à la première connexion."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                required
                disabled={Boolean(form.userId)}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nom affiché</Label>
              <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <Label>Rôle *</Label>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>
            {form.role === "prestataire" && (
              <div>
                <Label>Fiche prestataire *</Label>
                <Select value={form.providerId} onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}>
                  <option value="">Sélectionner…</option>
                  {freeProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Le prestataire ne verra que les interventions qui lui sont affectées.
                </p>
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="accent" disabled={submit.isPending}>
                <UserPlus className="size-4" />
                {form.userId ? "Accorder l’accès" : "Envoyer l’invitation"}
              </Button>
              {form.userId && (
                <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {(requestsQuery.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demandes d’accès en attente</CardTitle>
            <CardDescription>Comptes créés via l’ancienne inscription publique, sans aucun droit pour l’instant.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {(requestsQuery.data ?? []).map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{r.display_name || r.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.email} · demandé le {formatDateTime(r.created_at)}
                      {r.requested_role ? ` · souhaite : ${r.requested_role}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        userId: r.user_id,
                        email: r.email,
                        displayName: r.display_name ?? "",
                        role: r.requested_role === "prestataire" ? "prestataire" : "commercial",
                        providerId: "",
                      })
                    }
                  >
                    Traiter
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Équipe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {staffQuery.isLoading ? (
            <LoadingState />
          ) : staffQuery.error ? (
            <EmptyState title="Liste indisponible" description={(staffQuery.error as Error).message} />
          ) : (
            <TableShell className="rounded-none border-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Membre</TH>
                    <TH>Rôle</TH>
                    <TH>Dernière connexion</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {(staffQuery.data ?? []).map((m) => {
                    const isMe = m.user_id === user?.id;
                    return (
                      <TR key={m.user_id}>
                        <TD>
                          <p className="font-medium">{m.display_name || m.email}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </TD>
                        <TD>
                          {m.role === "prestataire" ? (
                            <div className="space-y-1">
                              <Badge>{ROLE_LABELS[m.role]}</Badge>
                              <p className="text-xs text-muted-foreground">Fiche : {m.provider_name ?? "—"}</p>
                            </div>
                          ) : (
                            <Select
                              value={m.role}
                              disabled={isMe || changeRole.isPending}
                              onChange={(e) => changeRole.mutate({ member: m, role: e.target.value as StaffRole })}
                            >
                              <option value="admin">{ROLE_LABELS.admin}</option>
                              <option value="commercial">{ROLE_LABELS.commercial}</option>
                            </Select>
                          )}
                        </TD>
                        <TD className="text-xs text-muted-foreground">{formatDateTime(m.last_sign_in_at)}</TD>
                        <TD className="text-right">
                          {!isMe && (
                            <Button size="sm" variant="ghost" onClick={() => setToRevoke(m)}>
                              Retirer l’accès
                            </Button>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(toRevoke)}
        onClose={() => setToRevoke(null)}
        onConfirm={() => {
          if (toRevoke) revoke.mutate(toRevoke);
        }}
        title="Retirer l’accès ?"
        description={`${toRevoke?.display_name || toRevoke?.email || ""} ne pourra plus rien consulter dans le CRM. Son historique est conservé.`}
        confirmLabel="Retirer"
        loading={revoke.isPending}
        destructive
      />
    </div>
  );
}
