/** Key-card cell: red agent, blue agent, bystander (neutral) or assassin. */
export type Color = "R" | "B" | "N" | "A";
export type Team = "R" | "B";

export const COLORS: readonly Color[] = ["R", "B", "N", "A"];
export const SIZE = 5;
export const CELLS = SIZE * SIZE;

/** A physical key card as transcribed, in arbitrary orientation. */
export interface KeyCard {
  card: number;
  start: Team;
  /** SIZE rows of SIZE characters from "RBNA". */
  grid: string[];
}

export interface Dataset {
  id: string;
  name: string;
  cards: KeyCard[];
}

/** One way a key card can sit in its stand: a card at one of 4 rotations. */
export interface Layout {
  card: number;
  /** Quarter turns clockwise from the transcribed orientation. */
  rotation: 0 | 1 | 2 | 3;
  start: Team;
  /** Row-major, index = row * SIZE + col. */
  cells: Color[];
}

/** Board position (row-major index 0..24) → revealed color. */
export type Reveals = ReadonlyMap<number, Color>;
