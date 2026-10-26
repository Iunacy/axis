import catalog from "./masters/catalog.json";
import type { MasterGame } from "./types";

export const MASTER_GAMES = catalog as unknown as MasterGame[];

export function getMasterGame(id: string): MasterGame | undefined {
  return MASTER_GAMES.find((g) => g.id === id);
}
