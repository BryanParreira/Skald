import { createDb } from "@notiz/db";
import { createUseDrizzleLiveQuery, createUseLiveQuery } from "@notiz/db-react";
import { tauriLiveQueryClient } from "@notiz/db-tauri";

export const db = createDb(tauriLiveQueryClient);
export const useLiveQuery = createUseLiveQuery(tauriLiveQueryClient);
export const useDrizzleLiveQuery =
  createUseDrizzleLiveQuery(tauriLiveQueryClient);
