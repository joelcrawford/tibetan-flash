// src/types.ts

export interface Card {
  tibetan: string;
  acip: string;
  meaning: string;
  notes: string;
  context: string;
  context_tibetan: string;
  session: string;
}

export type KnownMap = Record<string, boolean>;
