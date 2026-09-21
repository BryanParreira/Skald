import { useQuery } from "@tanstack/react-query";

import type { ConnectionItem } from "@notiz/api-client";

export function useConnections(_enabled = true) {
  return useQuery({
    queryKey: ["integration-status"],
    queryFn: async (): Promise<ConnectionItem[]> => [],
  });
}
