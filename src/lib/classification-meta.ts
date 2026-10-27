import type { MoveClassification } from "./types";

export const CLASSIFICATION_META: Record<MoveClassification, { glyph: string; name: { en: string; fr: string } }> = {
  brilliant: { glyph: "!!", name: { en: "Brilliant", fr: "Brillant" } },
  great: { glyph: "!", name: { en: "Great", fr: "Remarquable" } },
  best: { glyph: "★", name: { en: "Best", fr: "Meilleur" } },
  excellent: { glyph: "✓", name: { en: "Excellent", fr: "Excellent" } },
  good: { glyph: "·", name: { en: "Good", fr: "Bon" } },
  book: { glyph: "≡", name: { en: "Book", fr: "Théorie" } },
  inaccuracy: { glyph: "?!", name: { en: "Inaccuracy", fr: "Imprécision" } },
  mistake: { glyph: "?", name: { en: "Mistake", fr: "Erreur" } },
  miss: { glyph: "×", name: { en: "Miss", fr: "Occasion manquée" } },
  blunder: { glyph: "??", name: { en: "Blunder", fr: "Gaffe" } },
};
