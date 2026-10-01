import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";


export function ListTab({
  items,
  empty,
}: {
  empty: string;
  items: { id: string; href: string; title: string; subtitle: string; badge: React.ReactNode }[];
}) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={item.href} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              {item.badge}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
