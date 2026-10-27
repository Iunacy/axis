import type { PatternId } from "./types";

export interface PatternDefinition {
  id: PatternId;
  lichessTheme: string;
  name: { en: string; fr: string };
  principle: { en: string; fr: string };
  ids: readonly [string, string, string];
}

export const PATTERNS: readonly PatternDefinition[] = [
  {
    id: "back-rank", lichessTheme: "backRankMate",
    name: { en: "Back-rank mate", fr: "Mat du couloir" },
    principle: { en: "A king trapped behind its own pawns cannot escape a rook or queen on the back rank.", fr: "Un roi bloqué derrière ses pions ne peut fuir une tour ou une dame sur la dernière rangée." },
    ids: ["BjAzY", "iVCDS", "vNwuF"],
  },
  {
    id: "smothered", lichessTheme: "smotheredMate",
    name: { en: "Smothered mate", fr: "Mat étouffé" },
    principle: { en: "A knight checks a king whose own pieces occupy every escape square.", fr: "Un cavalier met en échec un roi dont les propres pièces occupent toutes les cases de fuite." },
    ids: ["jUqtI", "BUwRh", "IFEyi"],
  },
  {
    id: "arabian", lichessTheme: "arabianMate",
    name: { en: "Arabian mate", fr: "Mat arabe" },
    principle: { en: "A rook and knight coordinate to confine and mate a king in the corner.", fr: "Une tour et un cavalier coordonnent leurs forces pour mater un roi dans le coin." },
    ids: ["f2Msp", "p2wXS", "9IzbU"],
  },
  {
    id: "anastasia", lichessTheme: "anastasiaMate",
    name: { en: "Anastasia’s mate", fr: "Mat d’Anastasie" },
    principle: { en: "A knight seals an escape route while a rook or queen delivers mate along the edge.", fr: "Un cavalier ferme la fuite tandis qu’une tour ou une dame mate sur le bord." },
    ids: ["UCKJL", "UwC5Q", "s7wiG"],
  },
  {
    id: "boden", lichessTheme: "bodenMate",
    name: { en: "Boden’s mate", fr: "Mat de Boden" },
    principle: { en: "Two bishops cross diagonals around a king obstructed by its own pieces.", fr: "Deux fous croisent leurs diagonales autour d’un roi bloqué par ses propres pièces." },
    ids: ["rz4lN", "5SmZW", "njEAk"],
  },
  {
    id: "swallows-tail", lichessTheme: "swallowstailMate",
    name: { en: "Swallow’s-tail mate", fr: "Mat de la queue d’hirondelle" },
    principle: { en: "A queen mates while two of the king’s own pieces block diagonal escapes.", fr: "Une dame mate tandis que deux pièces du roi bloquent ses fuites diagonales." },
    ids: ["HmQiV", "bbzBu", "pC9ZO"],
  },
] as const;

export function findPattern(id: string): PatternDefinition | undefined {
  return PATTERNS.find(pattern => pattern.id === id);
}
