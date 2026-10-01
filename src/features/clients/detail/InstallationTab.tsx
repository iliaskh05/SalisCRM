import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { nullIfEmpty } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";
import { Field } from "./fields";

export function InstallationTab({
  clientId,
  installations,
  onSaved,
}: {
  clientId: string;
  installations: Tables<"client_installations">[];
  onSaved: () => void;
}) {
  const current = installations[0];
  const [form, setForm] = useState({
    label: current?.label ?? "Installation principale",
    hood_length: current?.hood_length ?? "",
    hood_type: current?.hood_type ?? "",
    filter_count: current?.filter_count?.toString() ?? "",
    filter_type: current?.filter_type ?? "",
    duct_present: current?.duct_present ?? false,
    duct_length: current?.duct_length ?? "",
    duct_accessibility: current?.duct_accessibility ?? "",
    motor_present: current?.motor_present ?? false,
    motor_type: current?.motor_type ?? "",
    motor_accessibility: current?.motor_accessibility ?? "",
    night_intervention: current?.night_intervention ?? false,
    schedule_preference: current?.schedule_preference ?? "",
    soil_level: current?.soil_level ?? "",
    remarks: current?.remarks ?? "",
  });

  useEffect(() => {
    const c = installations[0];
    setForm({
      label: c?.label ?? "Installation principale",
      hood_length: c?.hood_length ?? "",
      hood_type: c?.hood_type ?? "",
      filter_count: c?.filter_count?.toString() ?? "",
      filter_type: c?.filter_type ?? "",
      duct_present: c?.duct_present ?? false,
      duct_length: c?.duct_length ?? "",
      duct_accessibility: c?.duct_accessibility ?? "",
      motor_present: c?.motor_present ?? false,
      motor_type: c?.motor_type ?? "",
      motor_accessibility: c?.motor_accessibility ?? "",
      night_intervention: c?.night_intervention ?? false,
      schedule_preference: c?.schedule_preference ?? "",
      soil_level: c?.soil_level ?? "",
      remarks: c?.remarks ?? "",
    });
  }, [installations]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: clientId,
        label: nullIfEmpty(form.label),
        hood_length: nullIfEmpty(form.hood_length),
        hood_type: nullIfEmpty(form.hood_type),
        filter_count: form.filter_count === "" ? null : Number(form.filter_count),
        filter_type: nullIfEmpty(form.filter_type),
        duct_present: form.duct_present,
        duct_length: nullIfEmpty(form.duct_length),
        duct_accessibility: nullIfEmpty(form.duct_accessibility),
        motor_present: form.motor_present,
        motor_type: nullIfEmpty(form.motor_type),
        motor_accessibility: nullIfEmpty(form.motor_accessibility),
        night_intervention: form.night_intervention,
        schedule_preference: nullIfEmpty(form.schedule_preference),
        soil_level: nullIfEmpty(form.soil_level),
        remarks: nullIfEmpty(form.remarks),
        updated_at: new Date().toISOString(),
      };
      if (current) {
        const { error } = await supabase
          .from("client_installations")
          .update(payload)
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_installations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Installation enregistrée");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installation technique</CardTitle>
      </CardHeader>
      <CardContent>
        <RoleGate permission="installations:write" fallback={<p className="text-sm text-muted-foreground">Lecture seule</p>}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Libellé" className="sm:col-span-2">
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </Field>
            <Field label="Longueur hotte">
              <Input
                value={form.hood_length}
                onChange={(e) => setForm((f) => ({ ...f, hood_length: e.target.value }))}
              />
            </Field>
            <Field label="Type hotte">
              <Input
                value={form.hood_type}
                onChange={(e) => setForm((f) => ({ ...f, hood_type: e.target.value }))}
              />
            </Field>
            <Field label="Nb filtres">
              <Input
                type="number"
                value={form.filter_count}
                onChange={(e) => setForm((f) => ({ ...f, filter_count: e.target.value }))}
              />
            </Field>
            <Field label="Type filtres">
              <Input
                value={form.filter_type}
                onChange={(e) => setForm((f) => ({ ...f, filter_type: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.duct_present}
                onChange={(e) => setForm((f) => ({ ...f, duct_present: e.target.checked }))}
              />
              Conduit présent
            </label>
            <Field label="Longueur conduit">
              <Input
                value={form.duct_length}
                onChange={(e) => setForm((f) => ({ ...f, duct_length: e.target.value }))}
              />
            </Field>
            <Field label="Accessibilité conduit">
              <Input
                value={form.duct_accessibility}
                onChange={(e) => setForm((f) => ({ ...f, duct_accessibility: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.motor_present}
                onChange={(e) => setForm((f) => ({ ...f, motor_present: e.target.checked }))}
              />
              Moteur présent
            </label>
            <Field label="Type moteur">
              <Input
                value={form.motor_type}
                onChange={(e) => setForm((f) => ({ ...f, motor_type: e.target.value }))}
              />
            </Field>
            <Field label="Accessibilité moteur">
              <Input
                value={form.motor_accessibility}
                onChange={(e) => setForm((f) => ({ ...f, motor_accessibility: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.night_intervention}
                onChange={(e) => setForm((f) => ({ ...f, night_intervention: e.target.checked }))}
              />
              Intervention de nuit possible
            </label>
            <Field label="Préférence horaires">
              <Input
                value={form.schedule_preference}
                onChange={(e) => setForm((f) => ({ ...f, schedule_preference: e.target.value }))}
              />
            </Field>
            <Field label="Niveau d'encrassement">
              <Input
                value={form.soil_level}
                onChange={(e) => setForm((f) => ({ ...f, soil_level: e.target.value }))}
              />
            </Field>
            <Field label="Contraintes / remarques" className="sm:col-span-2">
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                Enregistrer l&apos;installation
              </Button>
            </div>
          </form>
        </RoleGate>
      </CardContent>
    </Card>
  );
}
