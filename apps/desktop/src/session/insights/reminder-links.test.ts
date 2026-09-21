import { describe, expect, it } from "vitest";

import { buildTaskReminderUrl, selectUnsentTasks } from "./reminder-links";

describe("buildTaskReminderUrl", () => {
  it("points back at the note and identifies the task", () => {
    expect(buildTaskReminderUrl("session-1", "task-1")).toBe(
      "notiz://notes/open?session_id=session-1&task_id=task-1",
    );
  });

  it("encodes ids safely", () => {
    const url = new URL(buildTaskReminderUrl("a b", "c&d"));
    expect(url.searchParams.get("session_id")).toBe("a b");
    expect(url.searchParams.get("task_id")).toBe("c&d");
  });
});

describe("selectUnsentTasks", () => {
  const tasks = [
    { taskId: "t1", status: "todo" },
    { taskId: "t2", status: "done" },
    { taskId: "t3", status: "todo" },
  ];

  it("skips completed tasks", () => {
    expect(selectUnsentTasks(tasks, "s1", []).map((t) => t.taskId)).toEqual([
      "t1",
      "t3",
    ]);
  });

  it("skips tasks already in Reminders", () => {
    const existing = [buildTaskReminderUrl("s1", "t1"), null];
    expect(
      selectUnsentTasks(tasks, "s1", existing).map((t) => t.taskId),
    ).toEqual(["t3"]);
  });

  it("does not treat another note's reminder as sent", () => {
    const existing = [buildTaskReminderUrl("other", "t1")];
    expect(
      selectUnsentTasks(tasks, "s1", existing).map((t) => t.taskId),
    ).toEqual(["t1", "t3"]);
  });
});
