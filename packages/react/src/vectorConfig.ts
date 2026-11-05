export type VectorTheme = {
  land: string;
  water: string;
  parks: string;
  roads: string;
  buildings: string;
  labels: string;
};

export const DEFAULT_VECTOR_THEME: VectorTheme = {
  land: "#f2f2ed",
  water: "#b9dbe9",
  parks: "#c8dfc1",
  roads: "#ffffff",
  buildings: "#deddea",
  labels: "#364555",
};

export const KEYLESS_VECTOR_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export interface VectorPerformanceEvent {
  phase: "style" | "idle";
  elapsedMs: number;
  styleUrl: string;
}
