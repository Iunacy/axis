"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Chess, type Square } from "chess.js";
import { getBoardTheme } from "@/lib/board-themes";
import { useI18n } from "@/lib/i18n";
import { loadSettings } from "@/lib/storage";
import type { BoardOverlaySpec, MoveClassification } from "@/lib/types";
import MoveBadge from "./MoveBadge";
import { boardPoint, promotionChoices } from "@/lib/board-interaction";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const PIECE_NAME: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

function pieceSrc(color: "w" | "b", type: string): string {
  return `/pieces/colorful/${color === "w" ? "white" : "black"}/${PIECE_NAME[type]}.svg`;
}

interface BoardProps {
  fen: string;
  orientation?: "w" | "b";
  interactive?: boolean;
  onTryMove?: (san: string) => boolean | void;
  defaultOverlays?: BoardOverlaySpec;
  showOverlayControls?: boolean;
  lastMove?: { from: string; to: string } | null;
  size?: "sm" | "md" | "lg";
  coordinates?: boolean;
  annotationEnabled?: boolean;
  suggestedMove?: { from: string; to: string } | null;
  evaluation?: { whiteShare: number | null; label: string };
  moveBadge?: { square: string; classification: MoveClassification };
}

interface SquareInfo {
  square: Square;
  piece: { type: string; color: "w" | "b" } | null;
  whiteAttackers: number;
  blackAttackers: number;
  hanging: boolean;
}

export default function Board({
  fen,
  orientation = "w",
  interactive = false,
  onTryMove,
  defaultOverlays,
  showOverlayControls = true,
  lastMove = null,
  size = "md",
  coordinates = true,
  annotationEnabled = false,
  suggestedMove,
  evaluation,
  moveBadge,
}: BoardProps) {
  const { t, locale } = useI18n();
  const boardId = useId();
  const [theme] = useState(() => getBoardTheme(loadSettings().boardTheme));
  const [position, setPosition] = useState(fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [focusSquare, setFocusSquare] = useState<Square>(orientation === "w" ? "e2" : "e7");
  const [beamSource, setBeamSource] = useState<Square | null>(null);
  const [showWhite, setShowWhite] = useState(Boolean(defaultOverlays?.whiteAttacks));
  const [showBlack, setShowBlack] = useState(Boolean(defaultOverlays?.blackAttacks));
  const [showHanging, setShowHanging] = useState(Boolean(defaultOverlays?.hanging));
  const [last, setLast] = useState(lastMove);
  const [anim, setAnim] = useState<{ to: Square; dx: number; dy: number; seq: number } | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; choices: string[] } | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotationSource, setAnnotationSource] = useState<Square | null>(null);
  const [userArrows, setUserArrows] = useState<{ from: string; to: string }[]>([]);
  const [markedSquares, setMarkedSquares] = useState<string[]>([]);
  const drawFrom = useRef<Square | null>(null);

  function dispDelta(from: string, to: string) {
    const colOf = (s: string) => {
      const i = FILES.indexOf(s[0] as (typeof FILES)[number]);
      return orientation === "w" ? i : 7 - i;
    };
    const rowOf = (s: string) => (orientation === "w" ? 8 - Number(s[1]) : Number(s[1]) - 1);
    return { dx: (colOf(from) - colOf(to)) * 100, dy: (rowOf(from) - rowOf(to)) * 100 };
  }

  const [externalFen, setExternalFen] = useState(fen);
  if (fen !== externalFen) {
    setExternalFen(fen);
    setPosition(fen);
    setSelected(null);
    setBeamSource(null);
    setLast(lastMove);
    setPromotion(null);
    setUserArrows([]);
    setMarkedSquares([]);
    setAnnotationSource(null);
    if (lastMove) {
      const d = dispDelta(lastMove.from, lastMove.to);
      setAnim((a) => ({ to: lastMove.to as Square, dx: d.dx, dy: d.dy, seq: (a?.seq ?? 0) + 1 }));
    } else {
      setAnim(null);
    }
  }

  const chess = useMemo(() => new Chess(position), [position]);

  const info: Map<Square, SquareInfo> = useMemo(() => {
    const map = new Map<Square, SquareInfo>();
    for (let r = 8; r >= 1; r--) {
      for (const f of FILES) {
        const sq = `${f}${r}` as Square;
        const piece = chess.get(sq) ?? null;
        const w = chess.attackers(sq, "w").length;
        const b = chess.attackers(sq, "b").length;
        const hanging = piece
          ? (piece.color === "w" ? b > w : w > b) && piece.type !== "k"
          : false;
        map.set(sq, { square: sq, piece, whiteAttackers: w, blackAttackers: b, hanging });
      }
    }
    return map;
  }, [chess]);

  const beamTargets: Set<Square> = useMemo(() => {
    const set = new Set<Square>();
    if (!beamSource) return set;
    const piece = chess.get(beamSource);
    if (!piece) return set;
    for (const [sq] of info) {
      if (chess.attackers(sq, piece.color).includes(beamSource)) set.add(sq);
    }
    return set;
  }, [beamSource, chess, info]);

  const legalTargets: Set<string> = useMemo(() => {
    if (!selected) return new Set();
    return new Set(chess.moves({ square: selected, verbose: true }).map((m) => m.to));
  }, [selected, chess]);

  function playMove(from: Square, to: Square, promote?: string) {
      const probe = new Chess(position);
      const move = probe.move({ from, to, promotion: promote });
      if (move) {
        const accepted = onTryMove ? onTryMove(move.san) !== false : true;
        if (accepted) {
          setPosition(probe.fen());
          setLast({ from: move.from, to: move.to });
          const d = dispDelta(move.from, move.to);
          setAnim((a) => ({ to: move.to as Square, dx: d.dx, dy: d.dy, seq: (a?.seq ?? 0) + 1 }));
        }
        setSelected(null);
        setBeamSource(null);
      }
      setPromotion(null);
  }

  function annotate(from: Square, to: Square) {
    if (from === to) setMarkedSquares(squares => squares.includes(to) ? squares.filter(square => square !== to) : [...squares, to]);
    else setUserArrows(arrows => arrows.some(arrow => arrow.from === from && arrow.to === to) ? arrows.filter(arrow => arrow.from !== from || arrow.to !== to) : [...arrows, { from, to }]);
  }

  function handleClick(sq: Square) {
    if (annotationEnabled && annotationMode) {
      if (annotationSource) { annotate(annotationSource, sq); setAnnotationSource(null); }
      else setAnnotationSource(sq);
      return;
    }
    const piece = chess.get(sq);
    if (interactive && selected && legalTargets.has(sq)) {
      const choices = promotionChoices(position, selected, sq);
      if (choices.length) setPromotion({ from: selected, to: sq, choices });
      else playMove(selected, sq);
      return;
    }

    if (piece) {
      if (interactive && piece.color === chess.turn()) {
        setSelected(selected === sq ? null : sq);
        setBeamSource(selected === sq ? null : sq);
      } else {
        setBeamSource(beamSource === sq ? null : sq);
        setSelected(null);
      }
    } else {
      setSelected(null);
      setBeamSource(null);
    }
  }

  const ranks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "w" ? [...FILES] : [...FILES].reverse();
  const maxW = size === "sm" ? "max-w-[320px]" : size === "lg" ? "max-w-[600px]" : "max-w-[480px]";

  return (
    <div className={`axis-board-root ${evaluation ? "has-eval" : ""} flex flex-col gap-3 w-full ${maxW}`}>
      <div role="group" aria-label={t.ui.chessboard} onContextMenu={event => { if (annotationEnabled) event.preventDefault(); }} className="axis-board-frame relative grid grid-cols-8 grid-rows-8 aspect-square w-full select-none">
        {evaluation && <div className={`axis-eval-bar ${orientation === "b" ? "is-flipped" : ""} ${evaluation.whiteShare === null ? "is-unavailable" : ""}`} role="img" aria-label={evaluation.label}>{evaluation.whiteShare !== null && <div style={{ height: `${Math.max(0, Math.min(100, evaluation.whiteShare * 100))}%` }}/>}</div>}
        {ranks.map((r) =>
          files.map((f) => {
            const square = `${f}${r}` as Square;
            const s = info.get(square)!;
            const dark = (FILES.indexOf(f) + r) % 2 === 1;
            const isSel = selected === square || beamSource === square || annotationSource === square;
            const inBeam = beamTargets.has(square);
            const isLast = Boolean(last && (last.from === square || last.to === square));
            const showW = showWhite && s.whiteAttackers > 0;
            const showB = showBlack && s.blackAttackers > 0;

            const inCheck = s.piece?.type === "k" && s.piece.color === chess.turn() && chess.isCheck();
            const bg = isSel
              ? dark ? theme.selectedDark : theme.selectedLight
              : isLast
              ? dark ? theme.lastMoveDark : theme.lastMoveLight
              : dark ? theme.darkSquare : theme.lightSquare;

            return (
              <button
                key={square}
                type="button"
                data-square={square}
                onClick={() => handleClick(square)}
                onPointerDown={event => { if (annotationEnabled && event.button === 2) { event.preventDefault(); drawFrom.current = square; } }}
                onPointerUp={event => { if (annotationEnabled && event.button === 2 && drawFrom.current) { annotate(drawFrom.current, square); drawFrom.current = null; } }}
                aria-label={square}
                aria-describedby={`${boardId}-${square}`}
                tabIndex={focusSquare === square ? 0 : -1}
                onFocus={() => setFocusSquare(square)}
                onKeyDown={event => {
                  if (event.key === "Escape") { setSelected(null); setBeamSource(null); setAnnotationSource(null); return; }
                  const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
                  const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
                  if (!dx && !dy) return;
                  event.preventDefault(); event.stopPropagation();
                  const col = Math.max(0, Math.min(7, files.indexOf(f) + dx));
                  const row = Math.max(0, Math.min(7, ranks.indexOf(r) + dy));
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
                  buttons?.[row * 8 + col]?.focus();
                }}
                style={{ backgroundColor: bg }}
                className={[
                  "relative w-full h-full flex items-center justify-center",
                  inBeam ? "axis-board-beam" : "",
                  isSel ? "axis-board-selected" : "",
                  inCheck ? "axis-board-check" : "",
                ].join(" ")}
              >
                <span className="sr-only" id={`${boardId}-${square}`}>{s.piece ? `${s.piece.color === "w" ? t.axis.white : t.axis.black} ${t.ui.pieces[s.piece.type as keyof typeof t.ui.pieces]}` : t.ui.emptySquare}{inCheck ? ` · ${t.ui.check}` : ""}{legalTargets.has(square) ? ` · ${t.ui.legalMove}` : ""}{isSel ? ` · ${t.ui.selectedSquare}` : ""}{isLast ? ` · ${t.ui.lastMove}` : ""}</span>
                {markedSquares.includes(square) && <span className="axis-square-annotation absolute inset-0 pointer-events-none"/>}
                {coordinates && f === files[0] && (
                  <span
                    className="absolute top-0.5 left-1 axis-board-coordinate pointer-events-none"
                  >
                    {r}
                  </span>
                )}
                {coordinates && r === ranks[7] && (
                  <span
                    className="absolute bottom-0 right-1 axis-board-coordinate pointer-events-none"
                  >
                    {f}
                  </span>
                )}

                {showHanging && s.hanging && (
                  <span className="absolute inset-1 rounded-full ring-2 ring-red-500/90 pointer-events-none z-10" />
                )}
                {s.piece && (
                  <PieceImg
                    src={pieceSrc(s.piece.color, s.piece.type)}
                    alt={`${s.piece.color}${s.piece.type}`}
                    slide={anim && anim.to === square ? anim : undefined}
                  />
                )}
                {moveBadge?.square === square && <span className="axis-board-grade"><MoveBadge classification={moveBadge.classification}/></span>}
                {legalTargets.has(square) && (
                  <span
                    className={[
                      "absolute pointer-events-none",
                      s.piece
                        ? "inset-0.5 rounded-full ring-[3px] ring-zinc-900/30"
                        : "w-1/3 h-1/3 rounded-full bg-zinc-900/40",
                    ].join(" ")}
                  />
                )}
                {(showW || showB) && (
                  <span className="absolute bottom-0.5 right-0.5 flex gap-0.5 pointer-events-none z-10">
                    {showW && (
                      <span className="min-w-3.5 h-3.5 px-0.5 rounded-full bg-emerald-600 text-[9px] font-bold text-white flex items-center justify-center shadow">
                        {s.whiteAttackers}
                      </span>
                    )}
                    {showB && (
                      <span className="min-w-3.5 h-3.5 px-0.5 rounded-full bg-zinc-900 text-[9px] font-bold text-zinc-100 flex items-center justify-center shadow">
                        {s.blackAttackers}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })
        )}
        <svg className="axis-board-arrows" viewBox="0 0 8 8" aria-hidden="true">
          <defs><marker id={`${boardId}-user-arrow`} markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><path d="M0 0 L2 1.25 L0 2.5 Z" fill="var(--board-user-arrow, #bd8d47)"/></marker><marker id={`${boardId}-engine-arrow`} markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><path d="M0 0 L2 1.25 L0 2.5 Z" fill="var(--edit-accent, #6b863d)"/></marker></defs>
          {userArrows.map(arrow => { const from = boardPoint(arrow.from, orientation); const to = boardPoint(arrow.to, orientation); return <line key={`${arrow.from}:${arrow.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--board-user-arrow, #bd8d47)" markerEnd={`url(#${boardId}-user-arrow)`}/>; })}
          {suggestedMove && (() => { const from = boardPoint(suggestedMove.from, orientation); const to = boardPoint(suggestedMove.to, orientation); return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--edit-accent, #6b863d)" markerEnd={`url(#${boardId}-engine-arrow)`}/>; })()}
        </svg>
      </div>
      {promotion && <PromotionDialog choices={promotion.choices} color={chess.turn()} label={locale === "fr" ? "Choisir la promotion" : "Choose promotion"} names={t.ui.pieces} onChoose={piece => playMove(promotion.from, promotion.to, piece)} onCancel={() => setPromotion(null)}/>}
      {annotationEnabled && <div className="axis-annotation-controls"><button type="button" aria-pressed={annotationMode} onClick={() => { setAnnotationMode(value => !value); setAnnotationSource(null); }}>{locale === "fr" ? "Dessiner" : "Draw"}</button><button type="button" disabled={!userArrows.length && !markedSquares.length} onClick={() => { setUserArrows([]); setMarkedSquares([]); setAnnotationSource(null); }}>{locale === "fr" ? "Effacer" : "Clear marks"}</button><span>{annotationMode ? locale === "fr" ? "Touchez deux cases ; deux fois la même pour la marquer." : "Tap two squares; tap one twice to mark it." : locale === "fr" ? "Clic droit : flèche ou case." : "Right-drag for an arrow; right-click to mark a square."}</span></div>}

      {showOverlayControls && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <OverlayToggle on={showWhite} setOn={setShowWhite} dotClass="bg-emerald-500" label={t.board.whiteAttacks} />
          <OverlayToggle on={showBlack} setOn={setShowBlack} dotClass="bg-zinc-900 ring-1 ring-zinc-400" label={t.board.blackAttacks} />
          <OverlayToggle on={showHanging} setOn={setShowHanging} dotClass="bg-red-500" label={t.board.hanging} />
          <span className="text-xs text-muted-foreground italic w-full">{t.board.clickHint}</span>
        </div>
      )}
    </div>
  );
}

function PromotionDialog({ choices, color, label, names, onChoose, onCancel }: { choices: string[]; color: "w" | "b"; label: string; names: Record<string, string>; onChoose: (piece: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="axis-promotion-dialog" aria-label={label} onCancel={event => { event.preventDefault(); onCancel(); }}><p>{label}</p><div>{choices.map(piece => <button type="button" key={piece} aria-label={names[piece]} onClick={() => onChoose(piece)}><Image src={pieceSrc(color, piece)} alt="" width={56} height={56} unoptimized/>{names[piece]}</button>)}</div><button type="button" className="axis-button secondary" onClick={onCancel}>×</button></dialog>;
}

function PieceImg({
  src,
  alt,
  slide,
}: {
  src: string;
  alt: string;
  slide?: { dx: number; dy: number; seq: number };
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seq = slide?.seq;
  const dx = slide?.dx;
  const dy = slide?.dy;
  useEffect(() => {
    if (dx !== undefined && dy !== undefined && ref.current?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ref.current.animate(
        [{ transform: `translate(${dx}%, ${dy}%)` }, { transform: "translate(0, 0)" }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
    }
  }, [seq, dx, dy]);

  return (
    <span ref={ref} className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
      <Image src={src} alt={alt} width={64} height={64} loading="eager" unoptimized draggable={false} className="w-[86%] h-[86%] object-contain drop-shadow-sm" />
    </span>
  );
}

function OverlayToggle({
  on,
  setOn,
  dotClass,
  label,
}: {
  on: boolean;
  setOn: (v: boolean) => void;
  dotClass: string;
  label: string;
}) {
  return (
    <button
      onClick={() => setOn(!on)}
      aria-pressed={on}
      className={[
        "flex items-center gap-2 rounded-full border px-3 py-1.5 transition",
        on ? "border-ring/60 bg-accent text-accent-foreground" : "border-input text-muted-foreground hover:border-ring/60",
      ].join(" ")}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
      {label}
    </button>
  );
}
