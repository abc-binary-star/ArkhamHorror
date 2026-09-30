import * as JsonDecoder from 'ts.data.json';
import { v2Optional } from '@/arkham/parser';
import { Tokens, tokensDecoder } from '@/arkham/types/Token';

export type AgendaSequence = {
  step: number
  side: string
}

export type Agenda = {
  doomPressure?: { total: number; threshold: number } | null;
  doom: number;
  // doomThreshold: GameValue;
  id: string;
  deckId: number;
  treacheries: string[];
  flipped: boolean;
  sequence: AgendaSequence
  tokens: Tokens;
}

export const agendaSequenceDecoder = JsonDecoder.object({
  agendaSequenceSide: JsonDecoder.string(),
  agendaSequenceStep: JsonDecoder.number(),
}, 'AgendaSequence').
  map(({agendaSequenceSide, agendaSequenceStep}) => { return { step: agendaSequenceStep, side: agendaSequenceSide } })

export const agendaDecoder = JsonDecoder.object<Agenda>({
  doomPressure: v2Optional(JsonDecoder.nullable(JsonDecoder.object({ total: JsonDecoder.number(), threshold: JsonDecoder.number() }, 'DoomPressure'))),
  doom: JsonDecoder.number(),
  // doomThreshold: gameValueDecoder,
  id: JsonDecoder.string(),
  deckId: JsonDecoder.number(),
  treacheries: JsonDecoder.array<string>(JsonDecoder.string(), 'TreacheryId[]'),
  flipped: JsonDecoder.boolean(),
  sequence: agendaSequenceDecoder,
  tokens: tokensDecoder,
}, 'Agenda');
