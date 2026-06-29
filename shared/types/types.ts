// src/types.ts

export interface Card {
  tibetan: string;
  acip: string;
  meaning: string;
  notes: string;
  context: string;
  context_tibetan: string;
  session: string;
  prompt?: string;
}

export type KnownMap = Record<string, boolean>;

export type CardStatus = "review" | "familiar" | "known";
export type StatusMap = Record<string, CardStatus>;
