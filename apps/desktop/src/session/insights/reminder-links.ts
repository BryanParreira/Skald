export function buildTaskReminderUrl(sessionId: string, taskId: string) {
  const params = new URLSearchParams({
    session_id: sessionId,
    task_id: taskId,
  });
  return `skald://notes/open?${params.toString()}`;
}

// The tasks table has nowhere to record that a task was sent, so the reminder's
// own URL doubles as the marker: a task is already sent if Reminders holds one
// pointing back at it.
export function selectUnsentTasks<T extends { taskId: string; status: string }>(
  tasks: T[],
  sessionId: string,
  existingReminderUrls: Iterable<string | null>,
): T[] {
  const sent = new Set(existingReminderUrls);
  return tasks.filter(
    (task) =>
      task.status !== "done" &&
      !sent.has(buildTaskReminderUrl(sessionId, task.taskId)),
  );
}
