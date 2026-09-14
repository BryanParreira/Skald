import { beforeEach, describe, expect, it, vi } from "vitest";

import { showSummaryReadyNotification } from "./summary-ready-notification";

const { showNotificationMock, isAppWindowInBackgroundMock } = vi.hoisted(
  () => ({
    showNotificationMock: vi.fn(),
    isAppWindowInBackgroundMock: vi.fn(),
  }),
);

vi.mock("@hypr/plugin-notification", () => ({
  commands: { showNotification: showNotificationMock },
}));

vi.mock("~/shared/app-window", () => ({
  isAppWindowInBackground: isAppWindowInBackgroundMock,
}));

describe("showSummaryReadyNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showNotificationMock.mockResolvedValue({ status: "ok", data: null });
  });

  it("does not notify while the summary is already on screen", async () => {
    isAppWindowInBackgroundMock.mockResolvedValue(false);

    await showSummaryReadyNotification("session-1", "Planning");

    expect(showNotificationMock).not.toHaveBeenCalled();
  });

  it("notifies with the note title and opens the note when clicked", async () => {
    isAppWindowInBackgroundMock.mockResolvedValue(true);

    await showSummaryReadyNotification("session-1", "Planning");

    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Summary ready",
        message: '"Planning" is ready to read.',
        source: { type: "session", session_id: "session-1" },
      }),
    );
  });

  it("uses a generic message when the note has no title", async () => {
    isAppWindowInBackgroundMock.mockResolvedValue(true);

    await showSummaryReadyNotification("session-1", "");

    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Your summary is ready to read." }),
    );
  });
});
