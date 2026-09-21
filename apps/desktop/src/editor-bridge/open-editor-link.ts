import { commands as openerCommands } from "@notiz/plugin-opener2";

export async function openEditorLink(href: string) {
  await openerCommands.openUrl(href, null);
}
