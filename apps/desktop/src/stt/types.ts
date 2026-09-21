import type { SpeakerHintStorage, WordStorage } from "@notiz/store";

export type WordWithId = WordStorage & { id: string };
export type SpeakerHintWithId = SpeakerHintStorage & { id: string };
