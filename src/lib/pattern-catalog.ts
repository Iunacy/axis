import type { PatternId } from "./types";

export interface PatternDefinition {
  id: PatternId;
  lichessTheme: string;
  name: { en: string; fr: string };
  principle: { en: string; fr: string };
  ids: readonly string[];
}

export const PATTERNS: readonly PatternDefinition[] = [
  {
    id: "back-rank", lichessTheme: "backRankMate",
    name: { en: "Back-rank mate", fr: "Mat du couloir" },
    principle: { en: "A king trapped behind its own pawns cannot escape a rook or queen on the back rank.", fr: "Un roi bloqué derrière ses pions ne peut fuir une tour ou une dame sur la dernière rangée." },
    ids: ["BjAzY","iVCDS","3g3qj","nYZLX","HkN82","vNwuF","99WGa","e6XLq","f805E","FnGc8"],
  },
  {
    id: "smothered", lichessTheme: "smotheredMate",
    name: { en: "Smothered mate", fr: "Mat étouffé" },
    principle: { en: "A knight checks a king whose own pieces occupy every escape square.", fr: "Un cavalier met en échec un roi dont les propres pièces occupent toutes les cases de fuite." },
    ids: ["jUqtI","75xGB","BUwRh","itHu0","2w3LR","tDtu4","IFEyi","h84je","8aztK","mko8t"],
  },
  {
    id: "arabian", lichessTheme: "arabianMate",
    name: { en: "Arabian mate", fr: "Mat arabe" },
    principle: { en: "A rook and knight coordinate to confine and mate a king in the corner.", fr: "Une tour et un cavalier coordonnent leurs forces pour mater un roi dans le coin." },
    ids: ["f2Msp","p2wXS","NoZCe","Lcgbh","1hfy0","3CSdR","gKAJy","yIeXB","9IzbU","uODMZ"],
  },
  {
    id: "anastasia", lichessTheme: "anastasiaMate",
    name: { en: "Anastasia’s mate", fr: "Mat d’Anastasie" },
    principle: { en: "A knight seals an escape route while a rook or queen delivers mate along the edge.", fr: "Un cavalier ferme la fuite tandis qu’une tour ou une dame mate sur le bord." },
    ids: ["UCKJL","UwC5Q","AWGx8","pDEHg","ymnao","9tURg","62U5z","WCYLO","s7wiG","UfJ5v"],
  },
  {
    id: "boden", lichessTheme: "bodenMate",
    name: { en: "Boden’s mate", fr: "Mat de Boden" },
    principle: { en: "Two bishops cross diagonals around a king obstructed by its own pieces.", fr: "Deux fous croisent leurs diagonales autour d’un roi bloqué par ses propres pièces." },
    ids: ["aBNco","O4Q8X","smaZS","rz4lN","broat","bQRDn","5SmZW","F2nST","jR9Kg","njEAk"],
  },
  {
    id: "swallows-tail", lichessTheme: "swallowstailMate",
    name: { en: "Swallow’s-tail mate", fr: "Mat de la queue d’hirondelle" },
    principle: { en: "A queen mates while two of the king’s own pieces block diagonal escapes.", fr: "Une dame mate tandis que deux pièces du roi bloquent ses fuites diagonales." },
    ids: ["HmQiV","MmzHF","Hnd42","MfdzR","bbzBu","1mItF","Szqid","pC9ZO","ztFCU","fR5ev"],
  },
  {"id": "dovetail", "lichessTheme": "dovetailMate", "name": {"en": "Dovetail mate", "fr": "Mat du guéridon"}, "principle": {"en": "The queen checks from an adjacent diagonal while the defender’s own pieces block two rear orthogonal escape squares.", "fr": "La dame donne échec sur une diagonale adjacente et deux pièces du roi bloquent les fuites orthogonales arrière."}, "ids": ["VSSAQ","2jGzR","Qa8lz","0UbEY","Hjjc1","I9jx8","0Atvh","QI2N0","ZwTqa","fll2W"]},
  {"id": "epaulette", "lichessTheme": "epauletteMate", "name": {"en": "Epaulette mate", "fr": "Mat des épaulettes"}, "principle": {"en": "Two of the checked king’s neighboring squares are occupied by its own pieces; coordinated attackers deny the remaining escapes.", "fr": "Deux cases voisines du roi en échec sont occupées par ses propres pièces ; les attaquants ferment les autres fuites."}, "ids": ["DPfIF","MY5mN","PjCVo","j2JKx","ZDzkY","mGy8C","KC98P","2XdtC","bwtRu","mSFgm"]},
  {"id": "hook", "lichessTheme": "hookMate", "name": {"en": "Hook mate", "fr": "Mat du crochet"}, "principle": {"en": "The rook gives the edge check, a knight protects it and seals a flight square, and a pawn supports the knight.", "fr": "La tour donne échec sur le bord, un cavalier la protège et ferme une fuite, et un pion soutient le cavalier."}, "ids": ["Vuh3K","1AZOY","gOk9t","pniUj","nXz5o","L19Uq","Ezr5k","h0L4D","92BRM","PNsuN"]},
  {"id": "vukovic", "lichessTheme": "vukovicMate", "name": {"en": "Vuković’s mate", "fr": "Mat de Vuković"}, "principle": {"en": "A rook gives the final check, a knight controls the king’s escape squares, and a third piece protects the rook.", "fr": "Une tour donne l’échec final, un cavalier contrôle les cases de fuite et une troisième pièce protège la tour."}, "ids": ["SgIFA","wFYdT","nzmrp","M9mmW","wHWCx","jPsmV","gAvnp","DOapb","UXbPr","0RMVy"]},
] as const;

export function findPattern(id: string): PatternDefinition | undefined {
  return PATTERNS.find(pattern => pattern.id === id);
}
