export interface BoardTheme {
  id: string;
  name: string;
  lightSquare: string;
  darkSquare: string;
  selectedLight: string;
  selectedDark: string;
  lastMoveLight: string;
  lastMoveDark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "classic", name: "Classique", lightSquare: "#ebecd0", darkSquare: "#739552", selectedLight: "#f6f669", selectedDark: "#baca44", lastMoveLight: "#cdd26a", lastMoveDark: "#aaa23a" },
  { id: "brown", name: "Bois", lightSquare: "#f0d9b5", darkSquare: "#b58863", selectedLight: "#f6f669", selectedDark: "#baca44", lastMoveLight: "#cdd26a", lastMoveDark: "#aaa23a" },
  { id: "blue", name: "Océan", lightSquare: "#dee3e6", darkSquare: "#8ca2ad", selectedLight: "#aae7ff", selectedDark: "#6fb3d2", lastMoveLight: "#9cc9d4", lastMoveDark: "#6d97a8" },
  { id: "grey", name: "Minimaliste", lightSquare: "#e2e5de", darkSquare: "#8e9992", selectedLight: "#cedca5", selectedDark: "#a5bc79", lastMoveLight: "#d3ddb5", lastMoveDark: "#adb995" },
];

export function getBoardTheme(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
