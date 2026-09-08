import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmer",
  loading = false,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button
          type="button"
          variant={destructive ? "default" : "accent"}
          className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          disabled={loading}
          onClick={() => void onConfirm()}
        >
          {loading ? "Patientez…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
