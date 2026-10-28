import { Chess } from "chess.js";
import { CLASSIFICATION_POLICY } from "./move-classification";
import { legalVariation } from "./analysis";
import { ENGINE_ID, validCachedEvaluation } from "./engine-protocol";
import { parsePgn } from "./pgn";
import { preparePuzzle } from "./puzzle-solution";
import { reviewExercise } from "./review-training";
import type { AnalysisSummary, GameRow, MoveIssue, PuzzleReview, PuzzleRow, LessonContent } from "./types";

export const SKILLS = [
  { id: "hanging-pieces", title: "Piece safety", fr: "Sécurité des pièces", objective: "Check what changes after your move, then compare captures and defensive resources.", concept: "An attacked piece is not automatically lost. Compare legal captures, intermediate checks, and the resulting position before choosing a defense.", objectiveFr: "Vérifiez ce que votre coup change, puis comparez prises et défenses.", conceptFr: "Une pièce attaquée n’est pas forcément perdue. Comparez les prises légales, les échecs intermédiaires et la position finale." },
  { id: "tactical-vision", title: "Tactical vision", fr: "Vision tactique", objective: "Find forcing candidate moves and calculate the opponent’s strongest reply.", concept: "Start with checks, captures, and direct threats for both sides. A promising first move needs a legal continuation against the best reply.", objectiveFr: "Trouvez les coups forcés et calculez la meilleure réponse adverse.", conceptFr: "Examinez échecs, prises et menaces des deux camps. Un bon premier coup doit résister à la meilleure réponse légale." },
  { id: "fork-recognition", title: "Fork recognition", fr: "Reconnaissance des fourchettes", objective: "Look for moves that attack multiple valuable targets, including the king.", concept: "Before committing, inspect the opponent’s forcing moves and double attacks. Check whether either target can move with tempo.", objectiveFr: "Cherchez les coups attaquant plusieurs cibles de valeur, roi compris.", conceptFr: "Avant de jouer, examinez les coups forcés et les attaques doubles adverses. Vérifiez si une cible peut se déplacer avec tempo." },
  { id: "king-safety", title: "King safety", fr: "Sécurité du roi", objective: "Identify the opponent’s mating threat and test a concrete defense.", concept: "Count legal escape squares and examine checks and defensive captures. An attractive attack is unsafe if your own king faces a forced mate.", objectiveFr: "Identifiez la menace de mat adverse et testez une défense concrète.", conceptFr: "Vérifiez les cases de fuite légales, les échecs et les prises défensives. Une attaque séduisante peut laisser votre roi face à un mat forcé." },
  { id: "calculation", title: "Material calculation", fr: "Calcul matériel", objective: "Replay the exchange sequence through the opponent’s best reply before evaluating material.", concept: "The value of the first capture does not settle an exchange. Include recaptures, checks, and threats in the resulting position.", objectiveFr: "Calculez la séquence d’échanges jusqu’à la meilleure réponse adverse.", conceptFr: "La première prise ne suffit pas à évaluer un échange. Incluez reprises, échecs et menaces dans la position finale." },
  { id: "opening-decisions", title: "Opening decisions", fr: "Décisions dans l’ouverture", objective: "Compare candidate moves in your own opening positions and explain the immediate threats.", concept: "These are evaluation losses during the opening, not proof of a theory gap. Review the concrete position before memorizing a line.", objectiveFr: "Comparez les coups candidats dans vos ouvertures et nommez les menaces immédiates.", conceptFr: "Ces pertes d’évaluation dans l’ouverture ne prouvent pas une lacune théorique. Analysez la position concrète avant de mémoriser une variante." },
  { id: "endgame-technique", title: "Endgame decisions", fr: "Décisions en finale", objective: "Calculate the critical continuation in simplified positions, including king and pawn moves.", concept: "In a simplified position, a tempo can change the result. Check legal king routes, pawn races, and forcing moves; the exercise tests this position, not every endgame.", objectiveFr: "Calculez la suite critique dans les positions simplifiées, avec rois et pions.", conceptFr: "En finale, un tempo peut changer le résultat. Vérifiez les trajets des rois, les courses de pions et les coups forcés. L’exercice teste cette position, pas toutes les finales." },
  { id: "conversion", title: "Converting an advantage", fr: "Conversion d’un avantage", objective: "Preserve an engine-evaluated advantage while checking the opponent’s counterplay.", concept: "A favorable evaluation does not make every exchange safe. Compare forcing replies and the resulting king safety before simplifying.", objectiveFr: "Préservez un avantage évalué par le moteur en vérifiant le contre-jeu adverse.", conceptFr: "Une évaluation favorable ne rend pas tous les échanges sûrs. Comparez les réponses forcées et la sécurité des rois avant de simplifier." },
] as const;
export type SkillId = typeof SKILLS[number]["id"];
export const isSkillId = (value: unknown): value is SkillId => SKILLS.some(skill => skill.id === value);
export const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
const DAY = 86400000;

export interface SkillEvidence { game: GameRow; issue: MoveIssue; position: string; line: string[] }
interface GameSample { game: GameRow; decisions: number; evidence: SkillEvidence[] }
export interface PracticeEvidence {
  positions: number; attempts: number; independentSuccesses: number; unseenSuccesses: number;
  retainedPositions: number; elapsedMs: number; rate: number | null;
  mastery: "unassessed" | "learning" | "retaining" | "demonstrated";
}
export interface TransferEvidence { beforeGames: number; afterGames: number; beforeRate: number | null; afterRate: number | null; direction: "insufficient" | "lower" | "higher" | "uncertain" }
export interface CurriculumItem {
  skill: typeof SKILLS[number]; evidence: SkillEvidence[]; games: number; mistakes: number;
  status: "unassessed" | "isolated" | "recurring"; rate: number | null; interval: [number, number];
  practice: PracticeEvidence; exercises: PuzzleRow[]; due: number; prerequisites: SkillId[];
  transfer: TransferEvidence; reassessment: boolean; reassessmentEpoch?: string;
}

export function issueSkills(issue: MoveIssue): SkillId[] {
  const result: SkillId[] = [];
  if (issue.motif === "hanging_piece") result.push("hanging-pieces");
  if (["missed_tactic", "missed_mate"].includes(issue.motif)) result.push("tactical-vision");
  if (issue.motif === "allowed_fork") result.push("fork-recognition");
  if (issue.motif === "allowed_mate") result.push("king-safety");
  if (issue.motif === "bad_trade") result.push("calculation");
  if (issue.phase === "opening") result.push("opening-decisions");
  if (issue.phase === "endgame") result.push("endgame-technique");
  if (issue.cpBefore >= 200 && issue.cpAfter < 100) result.push("conversion");
  return result;
}

/** 95% Wilson interval for observed errors per reviewed decision, not skill probability. */
export function errorInterval(errors: number, decisions: number): [number, number] {
  if (!decisions) return [0, 1];
  const z = 1.96, p = errors / decisions, scale = 1 + z * z / decisions;
  const center = (p + z * z / (2 * decisions)) / scale;
  const radius = z * Math.sqrt(p * (1 - p) / decisions + z * z / (4 * decisions * decisions)) / scale;
  return [Math.max(0, center - radius), Math.min(1, center + radius)];
}

const preparedCache = new Map<string, ReturnType<typeof preparePuzzle>>();
function preparedExercise(puzzle: PuzzleRow) {
  const key = JSON.stringify([puzzle.fen, puzzle.user_side, puzzle.solution_lines_uci, puzzle.solution_san, puzzle.reply_san]);
  if (preparedCache.has(key)) return preparedCache.get(key)!;
  const result = preparePuzzle(puzzle);
  preparedCache.set(key, result);
  if (preparedCache.size > 1000) preparedCache.delete(preparedCache.keys().next().value!);
  return result;
}

function samples(games: GameRow[], analyses: Record<string, AnalysisSummary>): GameSample[] {
  const unique = new Set<string>();
  return games.flatMap(game => {
    // Duplicate imports and opposite-side imports of the same PGN cannot multiply evidence.
    const summary = analyses[game.id];
    if (game.analysis_status !== "done" || summary?.complete !== true || summary.engineId !== ENGINE_ID) return [];
    const parsed = parsePgn(game.pgn);
    const signature = parsed && JSON.stringify(parsed.fens);
    if (!signature || unique.has(signature)) return [];
    const verified = new Set((summary.moveAssessments ?? []).filter(row => {
      const i = row.ply - 1;
      const before = summary.positionEvals?.[i], after = summary.positionEvals?.[i + 1];
      const reliableDepth = (before?.depth ?? 0) >= CLASSIFICATION_POLICY.minimumDepth && ((after?.depth ?? 0) >= CLASSIFICATION_POLICY.minimumDepth || after?.bestUci === null && new Chess(parsed.fens[i + 1]).isGameOver());
      return reliableDepth && row.color === game.user_color && row.confidence !== "limited" && row.classification !== null && parsed.moves[i]?.color === game.user_color
        && before?.engineId === ENGINE_ID && after?.engineId === ENGINE_ID && Number.isFinite(before.cpWhite) && Number.isFinite(after.cpWhite);
    }).map(row => row.ply));
    const seenPlies = new Set<number>();
    const evidence = summary.issues.flatMap(issue => {
      const before = summary.positionEvals?.[issue.ply - 1], after = summary.positionEvals?.[issue.ply];
      if (seenPlies.has(issue.ply) || !verified.has(issue.ply) || !issue.bestUci || before?.bestUci !== issue.bestUci || parsed.fens[issue.ply - 1] !== issue.fenBefore || !validCachedEvaluation(before, issue.fenBefore) || !validCachedEvaluation(after, parsed.fens[issue.ply]) || !reviewExercise(game, issue)) return [];
      seenPlies.add(issue.ply);
      return [{ game, issue, position: positionKey(issue.fenBefore), line: before!.pvUci }];
    });
    if (!verified.size) return [];
    unique.add(signature);
    return [{ game, decisions: verified.size, evidence }];
  });
}

const independent = (review: PuzzleReview) => review.solved && review.hintsUsed === 0 && review.wrongMoves === 0 && review.solutionRevealed === false;

/** Merge duplicate IDs by position and exclude immediate answer-conditioned retries from credit. */
function practiceEvents(puzzles: PuzzleRow[], now = new Date()) {
  const positions = new Map<string, PuzzleReview[]>();
  for (const puzzle of puzzles) {
    const key = positionKey(puzzle.fen);
    positions.set(key, [...(positions.get(key) ?? []), ...(puzzle.reviews ?? []).filter(review => Number.isFinite(Date.parse(review.at)) && Date.parse(review.at) <= now.getTime())]);
  }
  return [...positions.entries()].flatMap(([position, raw]) => {
    const reviews = [...new Map(raw.map(review => [JSON.stringify(review), review])).values()].sort((a,b) => a.at.localeCompare(b.at));
    const credited: boolean[] = [];
    return reviews.map((review,index) => {
      const gap = index ? Date.parse(review.at) - Date.parse(reviews[index-1].at) : Infinity;
      credited[index] = independent(review) && gap >= DAY;
      return { position, review, credited: credited[index], unseen: index === 0 && review.firstAttempt === true && credited[index], retained: index > 0 && gap >= 7 * DAY && credited[index] && credited[index-1] };
    });
  }).sort((a,b) => a.review.at.localeCompare(b.review.at));
}

export function practiceEvidence(puzzles: PuzzleRow[], now = new Date()): PracticeEvidence {
  const events = practiceEvents(puzzles, now), recent = events.slice(-20);
  const positions = new Set(events.map(event => event.position)).size;
  const unseenSuccesses = events.filter(event => event.unseen).length;
  const retainedPositions = new Set(events.filter(event => event.retained).map(event => event.position)).size;
  const independentSuccesses = events.filter(event => event.credited).length;
  const rate = recent.length ? recent.filter(event => event.credited).length / recent.length : null;
  const span = events.length > 1 ? Date.parse(events.at(-1)!.review.at) - Date.parse(events[0].review.at) : 0;
  const demonstrated = positions >= 5 && unseenSuccesses >= 3 && retainedPositions >= 3 && independentSuccesses >= 8 && recent.length >= 10 && rate! >= .8 && span >= 14 * DAY && events.slice(-3).every(event => event.credited);
  const elapsedMs = events.reduce((total,event) => total + (typeof event.review.elapsedMs === "number" && Number.isFinite(event.review.elapsedMs) && event.review.elapsedMs >= 0 ? event.review.elapsedMs : 0), 0);
  return { positions, attempts: events.length, independentSuccesses, unseenSuccesses, retainedPositions, elapsedMs, rate, mastery: demonstrated ? "demonstrated" : retainedPositions ? "retaining" : events.length ? "learning" : "unassessed" };
}

function transfer(skill: SkillId, rows: GameSample[], puzzles: PuzzleRow[]): TransferEvidence {
  const start = practiceEvents(puzzles).find(event => event.credited)?.review.at;
  const empty: TransferEvidence = { beforeGames: 0, afterGames: 0, beforeRate: null, afterRate: null, direction: "insufficient" };
  if (!start) return empty;
  const groups = new Map<string, GameSample[]>();
  for (const row of rows) { if (!row.game.time_control) continue; const key = `${row.game.platform}:${row.game.time_class}:${row.game.time_control ?? row.game.time_class}`; groups.set(key, [...(groups.get(key) ?? []), row]); }
  // Compare within a single platform/time-control pool. Never combine blitz and rapid ratings/decisions.
  const groupsSorted = [...groups.entries()].sort(([a, x], [b, y]) => y.length - x.length || a.localeCompare(b));
  for (const [, pool] of groupsSorted) {
    const before = pool.filter(row => Date.parse(row.game.played_at) < Date.parse(start)).sort((a,b) => b.game.played_at.localeCompare(a.game.played_at)).slice(0, 20);
    const after = pool.filter(row => Date.parse(row.game.played_at) > Date.parse(start)).sort((a,b) => b.game.played_at.localeCompare(a.game.played_at)).slice(0, 20);
    const count = (set: GameSample[]) => ({ moves: set.reduce((sum,row) => sum + row.decisions, 0), errors: set.reduce((sum,row) => sum + row.evidence.filter(e => issueSkills(e.issue).includes(skill)).length, 0) });
    const a = count(before), b = count(after);
    if (before.length < 5 || after.length < 5 || a.moves < 40 || b.moves < 40) continue;
    const ai = errorInterval(a.errors, a.moves), bi = errorInterval(b.errors, b.moves);
    return { beforeGames: before.length, afterGames: after.length, beforeRate: a.errors / a.moves, afterRate: b.errors / b.moves, direction: bi[1] < ai[0] ? "lower" : bi[0] > ai[1] ? "higher" : "uncertain" };
  }
  return empty;
}

export function curriculumHistory(games: GameRow[], analyses: Record<string, AnalysisSummary>) {
  return samples(games, analyses).sort((a,b) => Date.parse(b.game.played_at) - Date.parse(a.game.played_at) || a.game.id.localeCompare(b.game.id));
}

export function buildCurriculum(games: GameRow[], analyses: Record<string, AnalysisSummary>, puzzles: PuzzleRow[], now = new Date(), history?: ReturnType<typeof curriculumHistory>) {
  const allRows = history ?? curriculumHistory(games, analyses);
  const rows = allRows.slice(0, 50), decisions = rows.reduce((sum,row) => sum + row.decisions, 0);
  const indexed = puzzles.flatMap(puzzle => { const prepared = preparedExercise(puzzle); return prepared ? [{ puzzle, key: positionKey(puzzle.fen), best: prepared.lines[0]?.uci[0] }] : []; });
  const byPosition = new Map<string, typeof indexed>();
  for (const row of indexed) byPosition.set(row.key, [...(byPosition.get(row.key) ?? []), row]);
  const items: CurriculumItem[] = SKILLS.map(skill => {
    const evidence = rows.flatMap(row => row.evidence.filter(e => issueSkills(e.issue).includes(skill.id)));
    const uniquePositions = [...new Map(evidence.map(e => [e.position, e])).values()];
    const gameCount = new Set(evidence.map(e => e.game.id)).size;
    const exercises = uniquePositions.map(e => {
      const line = e.line.slice(0, 5); if (line.length % 2 === 0) line.pop();
      const matching = (byPosition.get(e.position) ?? []).filter(row => row.best === e.issue.bestUci && preparedExercise(row.puzzle)?.lines.some(candidate => line.every((move,index) => candidate.uci[index] === move))).map(row => row.puzzle);
      const existing = matching.sort((a,b) => (b.reviews?.length ?? 0) - (a.reviews?.length ?? 0))[0];
      if (existing) return existing;
      const base = reviewExercise(e.game, e.issue, now)!;
      const san = legalVariation(base.fen, line);
      return { ...base, id: `${base.id}:pv:${line.join("-")}`, solution_lines_uci: [line], solution_san: san.filter((_,index) => index % 2 === 0), reply_san: san.filter((_,index) => index % 2 === 1) };
    });
    // Related mates are source-validated puzzles, not additional weakness evidence.
    const related = skill.id === "tactical-vision" ? indexed.filter(row => row.puzzle.source === "lichess" && row.puzzle.pattern).map(row => row.puzzle) : [];
    const knownPositions = new Set<string>();
    const allExercises = [...exercises, ...related].filter(puzzle => { const key = positionKey(puzzle.fen); if (knownPositions.has(key)) return false; knownPositions.add(key); return true; });
    const targets = new Map(allExercises.map(exercise => [positionKey(exercise.fen), preparedExercise(exercise)?.lines[0]?.uci[0]]));
    const practicePool = indexed.filter(row => targets.get(row.key) === row.best).map(row => row.puzzle);
    const practice = practiceEvidence(practicePool, now);
    const firstCredit = practiceEvents(practicePool, now).find(event => event.credited)?.review.at;
    const laterErrors = firstCredit ? evidence.filter(e => Date.parse(e.game.played_at) > Date.parse(firstCredit)) : [];
    const reassessmentEpoch = new Set(laterErrors.map(e => e.game.id)).size >= 3 ? laterErrors.map(e => e.game.played_at).sort().at(-1) : undefined;
    const freshPractice = reassessmentEpoch ? practiceEvidence(practicePool.map(puzzle => ({ ...puzzle, reviews: puzzle.reviews?.filter(review => Date.parse(review.at) > Date.parse(reassessmentEpoch)) })), now) : practice;
    const reassessment = Boolean(reassessmentEpoch && freshPractice.mastery !== "demonstrated");
    if (reassessment) practice.mastery = freshPractice.mastery === "unassessed" ? "learning" : freshPractice.mastery;
    const due = allExercises.filter(p => !p.due_at || Date.parse(p.due_at) <= now.getTime() || reassessment && (!p.last_reviewed_at || Date.parse(p.last_reviewed_at) < Date.parse(reassessmentEpoch!))).length;
    return { skill, evidence: uniquePositions, games: gameCount, mistakes: evidence.length, status: gameCount >= 3 && uniquePositions.length >= 3 && rows.length >= 5 ? "recurring" : evidence.length ? "isolated" : "unassessed", rate: decisions ? evidence.length / decisions : null, interval: errorInterval(evidence.length, decisions), practice, exercises: allExercises, due, prerequisites: [], reassessment, reassessmentEpoch, transfer: transfer(skill.id, allRows, practicePool) };
  });
  const foundation = items.find(item => item.skill.id === "hanging-pieces")!;
  for (const item of items) if (["fork-recognition", "calculation"].includes(item.skill.id) && foundation.status === "recurring" && (foundation.reassessment || foundation.practice.unseenSuccesses < 2)) item.prerequisites = ["hanging-pieces"];
  items.sort((a,b) => Number(b.status === "recurring") - Number(a.status === "recurring") || Number(a.practice.mastery === "demonstrated") - Number(b.practice.mastery === "demonstrated") || a.prerequisites.length - b.prerequisites.length || Number(b.due > 0) - Number(a.due > 0) || b.mistakes - a.mistakes || a.skill.id.localeCompare(b.skill.id));
  const next = items.find(item => item.status === "recurring" && item.due > 0 && !item.prerequisites.length && item.practice.mastery !== "demonstrated") ?? items.find(item => item.exercises.length && item.due > 0);
  return { items, analyzedGames: rows.length, verifiedDecisions: decisions, nextSkillId: next?.skill.id ?? null };
}

export function curriculumQueue(item: CurriculumItem, now = new Date()): PuzzleRow[] {
  return item.exercises.filter(puzzle => !puzzle.due_at || Date.parse(puzzle.due_at) <= now.getTime() || item.reassessment && (!puzzle.last_reviewed_at || Date.parse(puzzle.last_reviewed_at) < Date.parse(item.reassessmentEpoch!)))
    .sort((a,b) => Number(a.source === "lichess") - Number(b.source === "lichess") || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || a.id.localeCompare(b.id)).slice(0, 8);
}


/** Select a focused study guide; reading carries no exercise/mastery credit. */
export function curriculumLesson(item: CurriculumItem, locale: "en" | "fr"): LessonContent & { title: string } {
  const fr = locale === "fr";
  return {
    title: fr ? item.skill.fr : item.skill.title,
    concept: fr ? item.skill.conceptFr : item.skill.concept,
    mission: fr ? item.skill.objectiveFr : item.skill.objective,
    sections: [
      { type: "text", heading: fr ? "Une routine de décision" : "A decision routine", body: fr ? "Nommez la menace adverse. Proposez deux coups candidats. Calculez une réponse forcée pour chacun et comparez les positions finales. Jouez ensuite votre choix dans l’exercice, avant de demander un indice." : "Name the opponent’s immediate threat. Propose two candidate moves. Calculate a forcing reply to each and compare the resulting positions. Then play your choice in the exercise before asking for a hint." },
      { type: "text", heading: fr ? "Des exemples de vos parties" : "Examples from your games", body: fr ? `${item.evidence.length} positions vérifiées sont disponibles dans ce parcours. Les exercices reprennent le coup candidat et les réponses enregistrés par le moteur. Une recherche limitée ne prouve pas que ce soit l’unique solution.` : `${item.evidence.length} verified game positions are available in this plan. Exercises use the candidate move and replies recorded by the engine. A bounded search does not prove a unique solution.` },
      { type: "text", heading: fr ? "Vérifier la compréhension" : "Test understanding", body: fr ? "Résolvez plusieurs positions nouvelles sans aide, puis revenez après un délai. Lire cette leçon ne donne aucun crédit de maîtrise. Les tentatives et la rétention se mesurent dans les exercices, avec une comparaison prudente aux parties suivantes." : "Solve several unseen positions without assistance, then return after a delay. Reading this guide earns no mastery credit. Attempts and retention are measured in the exercises, with cautious comparisons to later games." },
    ],
    primarySource: { label: "Stockfish analysis protocol", url: CLASSIFICATION_POLICY.source },
  };
}
