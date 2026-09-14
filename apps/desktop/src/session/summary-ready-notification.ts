import { commands as notificationCommands } from "@hypr/plugin-notification";

import { isAppWindowInBackground } from "~/shared/app-window";

export async function showSummaryReadyNotification(
  sessionId: string,
  title: string,
) {
  if (!(await isAppWindowInBackground())) {
    return;
  }

  try {
    const result = await notificationCommands.showNotification({
      key: `summary-ready:${sessionId}:${crypto.randomUUID()}`,
      title: "Summary ready",
      message: title
        ? `"${title}" is ready to read.`
        : "Your summary is ready to read.",
      timeout: null,
      source: { type: "session", session_id: sessionId },
      start_time: null,
      participants: null,
      event_details: null,
      action_label: "Open Velo",
      action_variant: null,
      options: null,
      footer: null,
      icon: null,
    });

    if (result.status === "error") {
      console.error(
        "[summary] failed to show ready notification",
        result.error,
      );
    }
  } catch (error) {
    console.error("[summary] failed to show ready notification", error);
  }
}
