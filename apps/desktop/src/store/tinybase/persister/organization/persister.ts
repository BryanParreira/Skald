import type { OrganizationStorage } from "@notiz/store";
import type { Schemas } from "@notiz/store";

import { parseOrganizationIdFromPath } from "./changes";
import {
  frontmatterToOrganization,
  organizationToFrontmatter,
} from "./transform";

import { createMarkdownDirPersister } from "~/store/tinybase/persister/factories";
import type { Store } from "~/store/tinybase/store/main";

export function createOrganizationPersister(store: Store) {
  return createMarkdownDirPersister<Schemas, OrganizationStorage>(store, {
    tableName: "organizations",
    dirName: "organizations",
    label: "OrganizationPersister",
    entityParser: parseOrganizationIdFromPath,
    toFrontmatter: organizationToFrontmatter,
    fromFrontmatter: frontmatterToOrganization,
  });
}
