import type { HumanStorage } from "@notiz/store";
import type { Schemas } from "@notiz/store";

import { parseHumanIdFromPath } from "./changes";
import { frontmatterToHuman, humanToFrontmatter } from "./transform";

import { createMarkdownDirPersister } from "~/store/tinybase/persister/factories";
import type { Store } from "~/store/tinybase/store/main";

export function createHumanPersister(store: Store) {
  return createMarkdownDirPersister<Schemas, HumanStorage>(store, {
    tableName: "humans",
    dirName: "humans",
    label: "HumanPersister",
    entityParser: parseHumanIdFromPath,
    toFrontmatter: humanToFrontmatter,
    fromFrontmatter: frontmatterToHuman,
  });
}
