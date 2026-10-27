import type { ReactNode } from "react";

export function Folio({ label, detail, number }: { label: string; detail?: string; number?: string }) {
  return <div className="edit-issue-line"><span>{label}</span><span>{detail}</span><span>{number}</span></div>;
}

export function EditorialHeading({ kicker, title, description, actions }: { kicker: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="edit-route-heading"><div><span className="edit-kicker">{kicker}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="axis-actions">{actions}</div>}</div>;
}
