export type Platform = "chesscom" | "lichess" | "pgn";
export type TimeClass = "bullet" | "blitz" | "rapid" | "daily" | "classical" | "correspondence";
export type GameResult = "win" | "loss" | "draw";
export type Phase = "opening" | "middlegame" | "endgame";
export type PatternId = "back-rank" | "smothered" | "arabian" | "anastasia" | "boden" | "swallows-tail";
export type MoveClassification = "brilliant" | "great" | "best" | "excellent" | "good" | "book" | "inaccuracy" | "mistake" | "miss" | "blunder";

export interface MoveAssessment {
  ply: number;
  color: "w" | "b";
  classification: MoveClassification | null;
  expectedLoss: number | null;
  confidence: "limited" | "supported" | "confirmed";
  reason: string;
  depth: number;
}

export type Motif =
  | "hanging_piece"
  | "missed_tactic"
  | "allowed_fork"
  | "allowed_mate"
  | "missed_mate"
  | "bad_trade"
  | "other";

export interface GameRow {
  id: string;
  platform: Platform;
  external_id: string;
  url: string | null;
  pgn: string;
  time_class: TimeClass;
  time_control: string | null;
  rated: boolean;
  played_at: string;
  user_color: "w" | "b";
  user_rating: number | null;
  opponent_rating: number | null;
  opponent_name: string | null;
  result: GameResult;
  eco: string | null;
  opening_name: string | null;
  accuracy_user: number | null;
  analysis_status: "pending" | "analyzing" | "done" | "failed" | "skipped";
}

export interface MoveIssue {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  severity: "blunder" | "mistake" | "inaccuracy";
  motif: Motif;
  phase: Phase;
  cpBefore: number;
  cpAfter: number;
  winDrop: number;
  bestUci: string | null;
  bestSan: string | null;
  continuation?: string[];
  classification?: MoveClassification;
}

export interface AnalysisSummary {
  acpl: number;
  acplSamples?: number;
  accuracy: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  issues: MoveIssue[];
  byPhase: Record<Phase, { blunders: number; mistakes: number; moves: number }>;
  engineDepthOrTime: string;
  engineId?: string;
  evaluations?: number[];
  positionEvals?: PositionEvaluation[];
  accuracyByColor?: { w: number | null; b: number | null };
  complete?: boolean;
  totalPlies?: number;
  analysisVersion?: number;
  ratingCoverageVersion?: number;
  openingBookVersion?: number;
  moveAssessments?: MoveAssessment[];
  opening?: { eco: string; name: string };
}

export interface EngineLine {
  cpWhite: number;
  pvUci: string[];
  depth: number;
  nodes: number;
  mate?: { winner: "w" | "b"; moves: number };
  wdlWhite?: [number, number, number];
}

export interface PositionEvaluation {
  cpWhite: number;
  bestUci: string | null;
  pvUci: string[];
  depth?: number;
  nodes?: number;
  mate?: { winner: "w" | "b"; moves: number };
  wdlWhite?: [number, number, number];
  lines?: EngineLine[];
  cacheHit?: boolean;
  engineId?: string;
}

export interface PuzzleRow {
  id: string;
  game_id: string;
  fen: string;
  solution_san: string[];
  reply_san: string[];
  theme: Motif;
  severity?: "blunder" | "mistake" | "inaccuracy";
  user_side: "w" | "b";
  source_url: string | null;
  due_at?: string;
  last_reviewed_at?: string;
  streak?: number;
  reviews?: PuzzleReview[];
  attempts: number;
  solved: boolean;
  created_at: string;
  kind?: "tactic" | "save";
  difficulty?: "easy" | "medium" | "hard";
  played_san?: string;
  solution_lines_uci?: string[][];
  source?: "game" | "lichess";
  pattern?: PatternId;
  rating?: number;
  rating_deviation?: number;
  themes?: string[];
  opening_tags?: string[];
  license?: "CC0-1.0";
}

export interface PuzzleReview {
  at: string;
  solved: boolean;
  firstAttempt?: boolean;
  hintsUsed?: number;
  elapsedMs?: number;
  wrongMoves?: number;
  solutionRevealed?: boolean;
  recognitionPending?: boolean;
  chosenPattern?: PatternId;
  recognizedPattern?: boolean;
}

export interface TrainingSession {
  skillId?: string;
  id: string;
  startedAt: string;
  remainingIds: string[];
  active: TrainingAttempt;
}

export interface TrainingAttempt {
  puzzleId: string;
  startedAt: string;
  path: string[];
  hintLevel: number;
  status: "playing" | "wrong" | "solved" | "revealed";
}

export interface LessonSectionText {
  type: "text";
  heading?: string;
  body: string;
}

export interface BoardOverlaySpec {
  whiteAttacks?: boolean;
  blackAttacks?: boolean;
  hanging?: boolean;
}

export interface LessonSectionBoard {
  type: "board";
  heading?: string;
  exampleIndex?: number;
  fen: string;
  orientation: "w" | "b";
  task: string;
  answerSan?: string[];
  playedSan?: string;
  theory?: string;
  answerLine?: string[];
  explain?: string;
  overlays?: BoardOverlaySpec;
  sourceUrl?: string | null;
}

export interface LessonQuizQuestion {
  q: string;
  choices: string[];
  answerIdx: number;
  explain: string;
}

export interface LessonSectionQuiz {
  type: "quiz";
  heading?: string;
  questions: LessonQuizQuestion[];
}

export type LessonSection = LessonSectionText | LessonSectionBoard | LessonSectionQuiz;

export interface LessonContent {
  concept: string;
  mission: string;
  sections: LessonSection[];
  primarySource: { label: string; url: string };
}

export interface GeneratedLesson {
  slug: string;
  theme: Motif | "lines_of_force";
  created_at: string;
  completed: boolean;
  examples: LessonExample[];
  stats: { totalAnalyzed: number; motifCount: number; blundersPerGame: number };
}

export interface LessonExample {
  fen: string;
  user_side: "w" | "b";
  solution_san: string[];
  reply_san?: string[];
  played?: string;
  source_url: string | null;
}

export type AnalysisMode = "fast" | "deep";

export interface Settings {
  chesscomUsername: string;
  lichessUsername: string;
  analyzeLastN: number;
  engineMovetimeMs: number;
  analysisMode?: AnalysisMode;
  boardTheme: string;
  soundEnabled?: boolean;
  voiceEnabled?: boolean;
  voiceURI?: string;
  voiceAutoplay?: boolean;
  showCoordinates?: boolean;
  showEvaluationBar?: boolean;
  reviewPlaybackMs?: number;
}

export interface AiLessonRow {
  id: string;
  locale: "en" | "fr";
  created_at: string;
  completed: boolean;
  title: string;
  content: LessonContent;
}

export interface WeaknessProfile {
  totalAnalyzed: number;
  avgAccuracy: number | null;
  blundersPerGame: number;
  topMotifs: { motif: Motif; count: number }[];
  weakestPhase: { phase: Phase; blunderRate: number } | null;
  worstOpenings: { eco: string; name: string | null; games: number; score: number }[];
}


export interface MasterGame {
  id: string;
  pgn: string;
  title: string;
  white: string;
  black: string;
  event: string | null;
  year: number;
  result: string;
  studySide: "w" | "b";
  tags: string[];
  sourceUrl: string | null;
  teaser: { en: string; fr: string };
  iconic?: number;
}

export interface MasterMoveNote {
  ply: number;
  reasoning: string;
  motif?: Motif;
}

export interface MasterAnnotation {
  gameId: string;
  locale: "en" | "fr";
  created_at: string;
  intro: string;
  notes: MasterMoveNote[];
}
