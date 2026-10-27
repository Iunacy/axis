import type { ReactNode } from "react";
import { EditorialHeading } from "./EditorialFrame";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <EditorialHeading kicker="AXIS / THE WORKSPACE" title={title} description={description} actions={actions}/>;
}

export function EmptyState({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return <section className="axis-empty"><span className="edit-kicker">A BLANK PAGE / READY TO BEGIN</span>{icon && <span className="axis-empty-icon" aria-hidden="true">{icon}</span>}<h2>{title}</h2>{description && <p>{description}</p>}{children && <div className="axis-actions">{children}</div>}</section>;
}
