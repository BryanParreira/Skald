import { describe, expect, test, vi } from "vitest";

import { buildNoteSaveOps } from "./note";

import { createTestMainStore } from "~/store/tinybase/persister/testing/mocks";

vi.mock("@tauri-apps/api/path", () => ({
  sep: () => "/",
}));

describe("buildNoteSaveOps", () => {
  test("does not delete empty memos when folder-only changes are saved", () => {
    const store = createTestMainStore();
    store.setRow("sessions", "session-1", {
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      title: "Test Session",
      folder_id: "work",
      event_json: "",
      raw_md: "",
    });

    const ops = buildNoteSaveOps(
      store,
      store.getTables(),
      "/data",
      new Set(["session-1"]),
      { deleteEmptyMemos: false },
    );

    expect(ops).toEqual([]);
  });

  test("deletes empty memos when note content is cleared", () => {
    const store = createTestMainStore();
    store.setRow("sessions", "session-1", {
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      title: "Test Session",
      folder_id: "work",
      event_json: "",
      raw_md: "",
    });

    const ops = buildNoteSaveOps(
      store,
      store.getTables(),
      "/data",
      new Set(["session-1"]),
      { deleteEmptyMemos: true },
    );

    expect(ops).toEqual([
      {
        type: "delete",
        paths: ["/data/sessions/work/session-1/_memo.md"],
      },
    ]);
  });

  test("does not touch memos for sessions whose raw_md was never loaded, even on a full save", () => {
    // Regression test: the initial app-startup load is metadata-only
    // (includeContent: false) — raw_md is populated lazily, only once a
    // session is opened. A full/unscoped save (changedSessionIds and
    // deleteEmptyMemos both reflecting "save everything", exactly what an
    // explicit persister.save() call produces, e.g. on app quit) must not
    // treat "never loaded this run" the same as "user emptied the note" —
    // doing so deletes on-disk content for every session not opened this
    // session, even ones written days ago.
    const store = createTestMainStore();
    store.setRow("sessions", "session-1", {
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      title: "Untouched Session",
      folder_id: "work",
      event_json: "",
      // raw_md intentionally omitted — never loaded into memory this run.
    });

    const ops = buildNoteSaveOps(
      store,
      store.getTables(),
      "/data",
      undefined,
      { deleteEmptyMemos: true },
    );

    expect(ops).toEqual([]);
  });
});
