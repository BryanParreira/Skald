import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Enhanced } from "./index";

import type { LLMConnectionStatus } from "~/ai/hooks";

const hoisted = vi.hoisted(() => ({
  task: undefined as
    | {
        status: string;
        error: Error | undefined;
        streamedText: string;
        currentStep: unknown;
        isGenerating: boolean;
      }
    | undefined,
  llmStatus: {
    status: "success",
    providerId: "velo",
    isHosted: true,
  } as LLMConnectionStatus,
  content: "",
  sessionMode: "inactive" as string,
  transcriptWords: undefined as Array<{ text: string }> | undefined,
}));

vi.mock("~/stt/contexts", () => ({
  useListener: (selector: (state: unknown) => unknown) =>
    selector({ getSessionMode: () => hoisted.sessionMode }),
}));

vi.mock("@hypr/ui/components/ui/spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock("~/ai/hooks", () => ({
  useAITaskTask: () => ({
    status: hoisted.task?.status ?? "idle",
    error: hoisted.task?.error,
    streamedText: hoisted.task?.streamedText ?? "",
    currentStep: hoisted.task?.currentStep,
    hasTask: !!hoisted.task,
    isGenerating: hoisted.task?.isGenerating ?? false,
  }),
  useLLMConnectionStatus: () => hoisted.llmStatus,
}));

vi.mock("~/store/tinybase/store/main", () => ({
  STORE_ID: "main",
  INDEXES: { transcriptBySession: "transcriptBySession" },
  UI: {
    useCell: () => hoisted.content,
    useSliceRowIds: () => (hoisted.transcriptWords ? ["transcript-1"] : []),
    useStore: () => ({
      getCell: () => JSON.stringify(hoisted.transcriptWords ?? []),
    }),
  },
}));

vi.mock("./config-error", () => ({
  ConfigError: () => <div>Config error</div>,
}));

vi.mock("./editor", () => ({
  EnhancedEditor: ({
    contentOverride,
  }: {
    contentOverride?: { content?: unknown[] };
  }) => {
    const collectText = (value: unknown): string => {
      if (!value || typeof value !== "object") {
        return "";
      }

      const node = value as {
        text?: unknown;
        content?: unknown[];
      };

      return [
        typeof node.text === "string" ? node.text : "",
        ...(node.content?.map(collectText) ?? []),
      ].join("");
    };

    return (
      <div>
        <span>Enhanced editor</span>
        {contentOverride ? <span>{collectText(contentOverride)}</span> : null}
      </div>
    );
  },
}));

vi.mock("./enhance-error", () => ({
  EnhanceError: () => <div>Enhance error</div>,
}));

describe("Enhanced", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    hoisted.task = undefined;
    hoisted.llmStatus = {
      status: "success",
      providerId: "velo",
      isHosted: true,
    };
    hoisted.content = "";
    hoisted.sessionMode = "inactive";
    hoisted.transcriptWords = undefined;
  });

  it("explains a brief summary when the recording was short", () => {
    hoisted.content = "summary";
    hoisted.transcriptWords = Array.from({ length: 46 }, () => ({
      text: "word",
    }));

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Enhanced editor")).not.toBeNull();
    expect(screen.getByText(/Short recording/)).not.toBeNull();
  });

  it("does not show the short recording hint for a normal recording", () => {
    hoisted.content = "summary";
    hoisted.transcriptWords = Array.from({ length: 400 }, () => ({
      text: "word",
    }));

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.queryByText(/Short recording/)).toBeNull();
  });

  it("renders an empty editor before the auto-enhance task is visible", () => {
    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Enhanced editor")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Preparing summary...")).toBeNull();
    expect(screen.queryByTestId("spinner")).toBeNull();
  });

  it("shows a skeleton while transcription is still running", () => {
    hoisted.sessionMode = "running_batch";

    const { container } = render(
      <Enhanced sessionId="session-1" enhancedNoteId="note-1" />,
    );

    expect(screen.queryByText("Enhanced editor")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("keeps showing existing summary content while transcription re-runs", () => {
    hoisted.sessionMode = "running_batch";
    hoisted.content = "previous summary";

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Enhanced editor")).not.toBeNull();
  });

  it("shows a generating status before streamed text arrives", () => {
    hoisted.task = {
      status: "generating",
      error: undefined,
      streamedText: "",
      currentStep: undefined,
      isGenerating: true,
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.queryByText("Enhanced editor")).toBeNull();
    expect(screen.getByRole("status")).not.toBeNull();
    expect(screen.getByText("Generating notes")).not.toBeNull();
  });

  it("renders streamed summary in the generating view", () => {
    hoisted.task = {
      status: "generating",
      error: undefined,
      streamedText: "Streaming summary",
      currentStep: undefined,
      isGenerating: true,
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.queryByText("Enhanced editor")).toBeNull();
    expect(screen.getByText("Streaming summary")).not.toBeNull();
    expect(screen.getByTestId("summary-title-space")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders the editor after an empty enhance task returns idle", () => {
    hoisted.task = {
      status: "idle",
      error: undefined,
      streamedText: "",
      currentStep: undefined,
      isGenerating: false,
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Enhanced editor")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows config errors for hosted subscription blockers", () => {
    hoisted.llmStatus = {
      status: "error",
      reason: "not_pro",
      providerId: "velo",
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Config error")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows config errors when hosted generation requires authentication", () => {
    hoisted.llmStatus = {
      status: "error",
      reason: "unauthenticated",
      providerId: "velo",
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Config error")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows config errors when a provider API key is missing", () => {
    hoisted.llmStatus = {
      status: "error",
      reason: "missing_config",
      providerId: "openai",
      missing: ["api_key"],
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Config error")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows config errors when a provider base URL is missing", () => {
    hoisted.llmStatus = {
      status: "error",
      reason: "missing_config",
      providerId: "openai",
      missing: ["base_url"],
    };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Config error")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not show config errors for missing provider setup", () => {
    hoisted.llmStatus = { status: "pending", reason: "missing_provider" };

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.queryByText("Config error")).toBeNull();
    expect(screen.getByText("Enhanced editor")).not.toBeNull();
  });

  it("renders the editor when the enhanced note already has content", () => {
    hoisted.content = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    });

    render(<Enhanced sessionId="session-1" enhancedNoteId="note-1" />);

    expect(screen.getByText("Enhanced editor")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
