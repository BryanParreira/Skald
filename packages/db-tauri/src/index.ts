import type { LiveQueryClient } from "@notiz/db-runtime";
import type { DrizzleProxyClient } from "@notiz/db-runtime";
import { execute, executeProxy, subscribe } from "@notiz/plugin-db";

export const tauriLiveQueryClient: LiveQueryClient & DrizzleProxyClient = {
  execute,
  executeProxy,
  subscribe,
};
