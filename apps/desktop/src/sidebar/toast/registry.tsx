import type { ServerStatus } from "@skald/plugin-local-stt";

import type { DownloadProgress, ToastCondition, ToastType } from "./types";

import type { DevtoolsToastPreview } from "~/store/zustand/devtools-toast-preview";

type ToastRegistryEntry = {
  toast: ToastType;
  condition: ToastCondition;
};

type ToastRegistryParams = {
  hasLLMConfigured: boolean;
  hasSttConfigured: boolean;
  isAiTranscriptionTabActive: boolean;
  isAiIntelligenceTabActive: boolean;
  hasActiveDownload: boolean;
  downloadProgress: number | null;
  downloadingModel: string | null;
  activeDownloads: DownloadProgress[];
  localSttStatus: ServerStatus | null;
  isLocalSttModel: boolean;
  onOpenLLMSettings: () => void;
  onOpenSTTSettings: () => void;
};

type DevtoolsToastPreviewParams = {
  preview: DevtoolsToastPreview;
  onSignIn: () => void | Promise<void>;
  onOpenLLMSettings: () => void;
  onOpenSTTSettings: () => void;
};

export function createToastRegistry({
  hasLLMConfigured,
  hasSttConfigured,
  isAiTranscriptionTabActive,
  isAiIntelligenceTabActive,
  hasActiveDownload,
  downloadProgress,
  downloadingModel,
  activeDownloads,
  localSttStatus,
  isLocalSttModel,
  onOpenLLMSettings,
  onOpenSTTSettings,
}: ToastRegistryParams): ToastRegistryEntry[] {
  const downloadTitle =
    activeDownloads.length === 1 && downloadingModel
      ? `Downloading ${downloadingModel}`
      : `Downloading ${activeDownloads.length} models`;

  // order matters
  return [
    {
      toast: {
        id: "downloading-model",
        description: downloadTitle,
        dismissible: false,
        progress:
          activeDownloads.length === 1 ? (downloadProgress ?? 0) : undefined,
        downloads: activeDownloads.length > 1 ? activeDownloads : undefined,
      },
      condition: () => hasActiveDownload,
    },
    {
      toast: {
        id: "local-stt-loading",
        description: "Starting transcription...",
        dismissible: false,
      },
      condition: () =>
        isLocalSttModel && localSttStatus === "loading" && !hasActiveDownload,
    },
    {
      toast: {
        id: "local-stt-unreachable",
        description: "Transcription unavailable",
        primaryAction: {
          label: "Settings",
          onClick: onOpenSTTSettings,
        },
        dismissible: true,
        variant: "error",
      },
      condition: () =>
        isLocalSttModel &&
        localSttStatus === "unreachable" &&
        !hasActiveDownload &&
        !isAiTranscriptionTabActive,
    },
    {
      toast: {
        id: "missing-stt",
        description: "Transcription model needed",
        primaryAction: {
          label: "Add",
          onClick: onOpenSTTSettings,
        },
        dismissible: false,
      },
      condition: () => !hasSttConfigured && !isAiTranscriptionTabActive,
    },
    {
      toast: {
        id: "missing-llm",
        description: "Language model needed",
        primaryAction: {
          label: "Add",
          onClick: onOpenLLMSettings,
        },
        dismissible: true,
      },
      condition: () =>
        hasSttConfigured && !hasLLMConfigured && !isAiIntelligenceTabActive,
    },
  ];
}

export function getToastToShow(
  registry: ToastRegistryEntry[],
  isDismissed: (id: string) => boolean,
): ToastType | null {
  for (const entry of registry) {
    if (entry.condition() && !isDismissed(entry.toast.id)) {
      return entry.toast;
    }
  }
  return null;
}

export function createDevtoolsToastPreview({
  preview,
  onSignIn,
  onOpenLLMSettings,
  onOpenSTTSettings,
}: DevtoolsToastPreviewParams): ToastType {
  switch (preview) {
    case "language-model":
      return {
        id: "devtools-missing-llm",
        description: "Language model needed",
        primaryAction: {
          label: "Add",
          onClick: onOpenLLMSettings,
        },
        dismissible: true,
      };
    case "transcription-model":
      return {
        id: "devtools-missing-stt",
        description: "Transcription model needed",
        primaryAction: {
          label: "Add",
          onClick: onOpenSTTSettings,
        },
        dismissible: false,
      };
    case "transcription-error":
      return {
        id: "devtools-local-stt-unreachable",
        description: "Transcription unavailable",
        primaryAction: {
          label: "Settings",
          onClick: onOpenSTTSettings,
        },
        dismissible: true,
        variant: "error",
      };
    case "download":
      return {
        id: "devtools-downloading-model",
        description: "Downloading model",
        dismissible: false,
        progress: 42,
      };
    case "pro":
      return {
        id: "devtools-upgrade-to-pro",
        description: "Pro features available",
        primaryAction: {
          label: "Upgrade",
          onClick: onSignIn,
        },
        dismissible: true,
      };
  }
}
