import { createDb } from "@skald/db";
import { createUseDrizzleLiveQuery, createUseLiveQuery } from "@skald/db-react";
import { tauriLiveQueryClient } from "@skald/db-tauri";

export const db = createDb(tauriLiveQueryClient);
export const useLiveQuery = createUseLiveQuery(tauriLiveQueryClient);
export const useDrizzleLiveQuery =
  createUseDrizzleLiveQuery(tauriLiveQueryClient);
