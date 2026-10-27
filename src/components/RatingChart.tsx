"use client";

import { useMemo, useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { Line, LineChart, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "./Workspace";

interface Point {
  date: string;
  rating: number;
  platform: string;
  timeClass: string;
}

export default function RatingChart({ series }: { series: Point[] }) {
  const { t, locale } = useI18n();
  const [combo, setCombo] = useState<string | null>(null);
  const [range, setRange] = useState("all");
  const combos = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of series) {
      const key = `${p.platform}:${p.timeClass}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  }, [series]);
  const active = combo && combos.includes(combo) ? combo : combos[0];
  const data = useMemo(() => {
    if (!active) return [];
    const [platform, timeClass] = active.split(":");
    const filtered = series.filter(p => p.platform === platform && p.timeClass === timeClass);
    return (range === "all" ? filtered : filtered.slice(-Number(range))).map(p => ({ date: Date.parse(p.date), rating: p.rating }));
  }, [series, active, range]);
  const dateLabel = (value: number) => new Date(value).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short" });
  const latest = data.at(-1)?.rating;
  const change = latest == null ? null : latest - data[0].rating;
  if (!series.length) return <div className="axis-chart-empty"><EmptyState icon={<ChartNoAxesCombined size={30}/>} title={t.ui.chartEmpty} description={t.ui.chartEmptyHelp}/></div>;
  return <div className="axis-rating-chart">
    <div className="axis-rating-heading"><div><h2>{t.dashboard.progression}</h2><strong>{latest}</strong><span className="axis-rating-delta">{change != null && `${change > 0 ? "+" : ""}${change}`} <small>{t.ui.ratingHistory}</small></span></div><div className="axis-rating-controls"><span>{data.length} {t.dashboard.games}</span><select className="axis-field" aria-label={t.ui.chartRange} value={range} onChange={event => setRange(event.target.value)}><option value="all">{t.ui.allHistory}</option><option value="30">{t.ui.last30}</option><option value="100">{t.ui.last100}</option></select></div></div>
    <div className="axis-chart-series" role="group" aria-label={t.dashboard.progression}>{combos.map(key => <button key={key} className="axis-choice" aria-pressed={key === active} onClick={() => setCombo(key)}>{key.replace("chesscom", "Chess.com").replace("lichess", "Lichess").replace(":", " · ")}</button>)}</div>
    <div className="axis-rating-plot" role="img" aria-label={`${t.dashboard.progression}: ${latest}`}>
        <LineChart responsive style={{ width: "100%", height: "100%", minWidth: 0 }} data={data} margin={{ top: 12, right: 10, bottom: 0, left: -12 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5"/>
          <XAxis dataKey="date" tickFormatter={dateLabel} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={44}/>
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={["dataMin - 30", "dataMax + 30"]} allowDecimals={false} width={50}/>
          <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB")} formatter={value => [value, t.ui.rating]} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" }} labelStyle={{ color: "var(--muted-foreground)", marginBottom: 6 }} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}/>
          <Line type="linear" dataKey="rating" stroke="var(--chart-line)" strokeWidth={1.8} dot={data.length === 1 ? { r: 3 } : false} activeDot={{ r: 4, strokeWidth: 3, stroke: "var(--background)" }} isAnimationActive={false}/>
        </LineChart>
    </div>
  </div>;
}
