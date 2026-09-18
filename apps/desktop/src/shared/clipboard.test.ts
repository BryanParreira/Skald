import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "./clipboard";

const { successMock, errorMock } = vi.hoisted(() => ({
  successMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("@skald/ui/components/ui/toast", () => ({
  sonnerToast: { success: successMock, error: errorMock },
}));

function installClipboard(clipboard: {
  write?: (...args: unknown[]) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}) {
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
}

const messages = { success: "Copied", error: "Could not copy" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ClipboardItem",
    class {
      constructor(public items: Record<string, Blob>) {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextToClipboard", () => {
  it("writes markdown and plain text together when supported", async () => {
    const write = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    installClipboard({ write, writeText });

    await expect(copyTextToClipboard("# Note", messages)).resolves.toBe(true);

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(successMock).toHaveBeenCalledWith("Copied");
  });

  it("falls back to plain text when rich copy fails", async () => {
    const write = vi.fn(() => Promise.reject(new Error("unsupported")));
    const writeText = vi.fn(() => Promise.resolve());
    installClipboard({ write, writeText });

    await expect(copyTextToClipboard("# Note", messages)).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("# Note");
    expect(successMock).toHaveBeenCalledWith("Copied");
  });

  it("reports failure when nothing can be copied", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installClipboard({
      write: vi.fn(() => Promise.reject(new Error("denied"))),
      writeText: vi.fn(() => Promise.reject(new Error("denied"))),
    });

    await expect(copyTextToClipboard("# Note", messages)).resolves.toBe(false);

    expect(errorMock).toHaveBeenCalledWith("Could not copy");
    expect(successMock).not.toHaveBeenCalled();
  });

  it("stays silent when no messages are given", async () => {
    installClipboard({
      write: vi.fn(() => Promise.resolve()),
      writeText: vi.fn(() => Promise.resolve()),
    });

    await copyTextToClipboard("# Note");

    expect(successMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });
});
