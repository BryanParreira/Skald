import { useQuery } from "@tanstack/react-query";

import { env } from "~/env";

export function useWebResources<T>(endpoint: string) {
  return useQuery({
    queryKey: ["settings", endpoint, "suggestions"],
    queryFn: async () => {
      const response = await fetch(
        new URL(`/api/${endpoint}`, env.VITE_APP_URL).toString(),
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) {
        return [];
      }
      return response.json() as Promise<T[]>;
    },
  });
}
