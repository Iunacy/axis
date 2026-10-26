import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="axis-page-head"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="axis-actions">{actions}</div>}</div>;
}

export function EmptyState({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return <section className="axis-empty">{icon && <span className="axis-empty-icon" aria-hidden="true">{icon}</span>}<h2>{title}</h2>{description && <p>{description}</p>}{children && <div className="axis-actions">{children}</div>}</section>;
}
