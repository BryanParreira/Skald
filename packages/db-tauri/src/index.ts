import type { LiveQueryClient } from "@skald/db-runtime";
import type { DrizzleProxyClient } from "@skald/db-runtime";
import { execute, executeProxy, subscribe } from "@skald/plugin-db";

export const tauriLiveQueryClient: LiveQueryClient & DrizzleProxyClient = {
  execute,
  executeProxy,
  subscribe,
};
