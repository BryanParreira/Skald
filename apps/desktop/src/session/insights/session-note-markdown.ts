import { json2md } from "@notiz/editor/markdown";

import * as main from "~/store/tinybase/store/main";

export function getSessionNoteMarkdown(
  store: NonNullable<ReturnType<typeof main.UI.useStore>>,
  sessionId: string,
): string {
  const notes: Array<{ content: string; position: number }> = [];

  store.forEachRow("enhanced_notes", (noteId, _forEachCell) => {
    const note = store.getRow("enhanced_notes", noteId);
    if (note.session_id !== sessionId || !note.content?.trim()) {
      return;
    }
    notes.push({
      content: note.content,
      position: typeof note.position === "number" ? note.position : 0,
    });
  });

  notes.sort((a, b) => a.position - b.position);

  const sections: string[] = [];
  for (const note of notes) {
    try {
      const md = json2md(JSON.parse(note.content));
      if (md.trim()) {
        sections.push(md);
      }
    } catch {
      // Ignore notes that aren't valid TipTap JSON.
    }
  }

  return sections.join("\n\n");
}
