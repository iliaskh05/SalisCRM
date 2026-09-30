import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type Pagination<T> = {
  pageItems: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
};

/** Affichage par pages côté navigateur : évite de rendre des milliers de lignes d'un coup. */
export function usePagination<T>(items: T[], pageSize = 50): Pagination<T> {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Retour à la page 1 quand la liste change (recherche, filtre, rechargement)
  useEffect(() => setPage(1), [items]);

  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    setPage,
  };
}

export function Pager<T>({ pager }: { pager: Pagination<T> }) {
  if (pager.pageCount <= 1) return null;
  return (
    <nav className="mt-3 flex items-center justify-between text-sm text-muted-foreground" aria-label="Pagination">
      <span>
        {pager.from}–{pager.to} sur {pager.total}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={pager.page <= 1} onClick={() => pager.setPage(pager.page - 1)}>
          Précédent
        </Button>
        <span>
          Page {pager.page} / {pager.pageCount}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pager.page >= pager.pageCount}
          onClick={() => pager.setPage(pager.page + 1)}
        >
          Suivant
        </Button>
      </div>
    </nav>
  );
}
