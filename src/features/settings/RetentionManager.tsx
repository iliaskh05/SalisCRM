import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STORAGE_BUCKETS } from "@/lib/constants";
import { supabase } from "@/lib/supabase/client";

type PurgeResult = { dry_run: boolean; months: number; candidates: number; deleted: number; storage_paths: string[] };

/** Conservation des données : purge des demandes anciennes jamais converties (simulation d'abord). */
export function RetentionManager() {
  const qc = useQueryClient();
  const [months, setMonths] = useState("36");
  const [preview, setPreview] = useState<PurgeResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = useMutation({
    mutationFn: async (dryRun: boolean): Promise<PurgeResult> => {
      const { data, error } = await supabase.rpc("purge_expired_leads", { p_months: Number(months), p_dry_run: dryRun });
      if (error) throw error;
      const result = data as PurgeResult;

      // Les fichiers ne se suppriment que par l'API Storage (pas en SQL)
      if (!dryRun && result.storage_paths.length > 0) {
        for (let i = 0; i < result.storage_paths.length; i += 100) {
          const { error: rmError } = await supabase.storage
            .from(STORAGE_BUCKETS.leadDocuments)
            .remove(result.storage_paths.slice(i, i + 100));
          if (rmError) toast.warning("Certaines photos n’ont pas pu être supprimées", { description: rmError.message });
        }
      }
      return result;
    },
    onSuccess: async (result) => {
      if (result.dry_run) {
        setPreview(result);
        return;
      }
      toast.success(`${result.deleted} demande(s) supprimée(s)`);
      setPreview(null);
      setConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["quote-requests"] });
    },
    onError: (e: Error) => toast.error("Opération impossible", { description: e.message }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conservation des données</CardTitle>
        <CardDescription>
          Supprime les demandes du site jamais converties en client, sans devis, plus anciennes que la durée choisie (36
          mois est la durée usuelle pour un prospect). Les clients, devis et factures ne sont jamais concernés. Une
          simulation est toujours faite avant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Label htmlFor="retention-months">Durée (mois)</Label>
            <Input
              id="retention-months"
              type="number"
              min={12}
              max={120}
              value={months}
              onChange={(e) => {
                setMonths(e.target.value);
                setPreview(null);
              }}
            />
          </div>
          <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(true)}>
            Simuler
          </Button>
        </div>

        {preview && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            {preview.candidates === 0 ? (
              <p>Aucune demande de plus de {preview.months} mois à supprimer.</p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>
                  <b>{preview.candidates}</b> demande(s) de plus de {preview.months} mois seraient supprimées
                  {preview.storage_paths.length > 0 ? `, ainsi que ${preview.storage_paths.length} photo(s)` : ""}.
                </p>
                <Button
                  size="sm"
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => setConfirmOpen(true)}
                >
                  Supprimer définitivement
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => run.mutate(false)}
        title="Supprimer ces demandes ?"
        description={`${preview?.candidates ?? 0} demande(s) et leurs photos seront supprimées définitivement, y compris du journal d’audit. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loading={run.isPending}
        destructive
      />
    </Card>
  );
}
