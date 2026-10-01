import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RoleGate } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { storageFileName } from "@/lib/storage";
import { DOCUMENT_TYPE_LABELS, STORAGE_BUCKETS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { DocumentType, Tables } from "@/lib/supabase/types";
import { Field } from "./fields";

export function DocumentsTab({
  clientId,
  documents,
  userId,
  onChanged,
}: {
  clientId: string;
  documents: Tables<"documents">[];
  userId?: string;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocumentType>("other");
  const [file, setFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<Tables<"documents"> | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choisissez un fichier");
      const path = `${clientId}/${storageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.clientDocuments)
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        client_id: clientId,
        doc_type: docType,
        title: title.trim() || file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId ?? null,
      });
      if (error) {
        await supabase.storage.from(STORAGE_BUCKETS.clientDocuments).remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Document ajouté");
      setTitle("");
      setFile(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDoc = async (doc: Tables<"documents">) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.clientDocuments)
      .createSignedUrl(doc.storage_path, 120);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Impossible d'ouvrir le document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const remove = useMutation({
    mutationFn: async (doc: Tables<"documents">) => {
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from(STORAGE_BUCKETS.clientDocuments).remove([doc.storage_path]);
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      setToDelete(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <RoleGate permission="documents:write">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un document</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Field label="Titre">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fichier">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="sm:col-span-3">
              <Button
                variant="accent"
                disabled={upload.isPending}
                onClick={() => upload.mutate()}
              >
                <Upload className="size-4" />
                Téléverser
              </Button>
            </div>
          </CardContent>
        </Card>
      </RoleGate>

      {documents.length === 0 ? (
        <EmptyState title="Aucun document" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[d.doc_type]} · {formatDateTime(d.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void openDoc(d)}>
                    Ouvrir
                  </Button>
                  <RoleGate permission="documents:write">
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(d)}>
                      Supprimer
                    </Button>
                  </RoleGate>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Supprimer ce document ?"
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />
    </div>
  );
}
