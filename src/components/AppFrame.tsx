"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const application = pathname !== "/" && pathname !== "/licenses";
  return <div className={application ? "axis-app-frame" : "axis-public-frame"}>{children}</div>;
}
