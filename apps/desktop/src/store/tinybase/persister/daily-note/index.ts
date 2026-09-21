import * as _UI from "tinybase/ui-react/with-schemas";

import { getCurrentWebviewWindowLabel } from "@notiz/plugin-windows";
import { type Schemas } from "@notiz/store";

import { createDailyNotePersister } from "./persister";

import type { Store } from "~/store/tinybase/store/main";

const { useCreatePersister } = _UI as _UI.WithSchemas<Schemas>;

export function useDailyNotePersister(store: Store) {
  return useCreatePersister(
    store,
    async (store) => {
      const persister = createDailyNotePersister(store as Store);
      if (getCurrentWebviewWindowLabel() === "main") {
        await persister.startAutoPersisting();
      } else {
        await persister.startAutoLoad();
      }
      return persister;
    },
    [],
  );
}
