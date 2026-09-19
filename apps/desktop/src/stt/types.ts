import type { SpeakerHintStorage, WordStorage } from "@skald/store";

export type WordWithId = WordStorage & { id: string };
export type SpeakerHintWithId = SpeakerHintStorage & { id: string };
