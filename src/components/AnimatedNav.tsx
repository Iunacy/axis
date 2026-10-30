"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motionTiming } from "@/lib/ui-motion";

/** Only the active rule moves; links and route content remain immediately usable. */
export default function AnimatedNav({ children, label, selection, className = "" }: {
  children: ReactNode;
  label: string;
  selection: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const animation = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const nav = ref.current;
    const rule = nav?.querySelector<HTMLElement>(".axis-nav-indicator");
    if (!nav || !rule) return;

    function position(animate: boolean) {
      if (!nav || !rule) return;
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      const previous = rule.getBoundingClientRect();
      const bounds = nav.getBoundingClientRect();
      const target = active?.getBoundingClientRect();
      animation.current?.cancel();
      rule.hidden = !target;
      if (!target) return;
      // Include scrollLeft so secondary navigation stays aligned on small screens.
      const x = target.left - bounds.left + nav.scrollLeft;
      const destination = `translateX(${x}px) scaleX(${target.width})`;
      rule.style.transform = destination;
      if (animate && nav.dataset.motionReady && previous.width > 0) {
        const timing = motionTiming(nav, "panel");
        if (timing.duration) animation.current = rule.animate([
          { transform: `translateX(${previous.left - bounds.left + nav.scrollLeft}px) scaleX(${previous.width})` },
          { transform: destination },
        ], timing);
      }
      nav.dataset.motionReady = "true";
    }

    position(true);
    let observed = false;
    const observer = new ResizeObserver(() => {
      // The initial observation must not cancel a route transition just started above.
      if (observed) position(false);
      observed = true;
    });
    observer.observe(nav);
    nav.querySelectorAll("a").forEach(link => observer.observe(link));
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => position(false);
    preference.addEventListener("change", settle);
    return () => { observer.disconnect(); preference.removeEventListener("change", settle); };
  }, [selection]);

  useLayoutEffect(() => () => { animation.current?.cancel(); }, []);

  return <nav ref={ref} aria-label={label} className={`axis-animated-nav ${className}`}>
    {children}<span className="axis-nav-indicator" aria-hidden="true" hidden />
  </nav>;
}
