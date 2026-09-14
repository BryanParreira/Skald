import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

import {
  commands as localLlmCommands,
  events as localLlmEvents,
  type GgufLlmModel,
} from "@hypr/plugin-local-llm";

// Qwen2p5_3bQ4's download URL (a GitHub release asset in this fork) 404s —
// the release was never published here. Llama3p2_3bQ4 is hosted on S3 and
// confirmed reachable; same size/class of model. Switch back to Qwen once
// that release exists.
export const DEFAULT_LOCAL_LLM_MODEL: GgufLlmModel = "Llama3p2_3bQ4";

export const localLlmKeys = {
  all: ["local-llm"] as const,
  model: (model: GgufLlmModel) =>
    [...localLlmKeys.all, "model", model] as const,
  downloaded: (model: GgufLlmModel) =>
    [...localLlmKeys.model(model), "downloaded"] as const,
  downloading: (model: GgufLlmModel) =>
    [...localLlmKeys.model(model), "downloading"] as const,
  serverUrl: () => [...localLlmKeys.all, "server-url"] as const,
};

export const localLlmQueries = {
  isDownloaded: (model: GgufLlmModel) =>
    queryOptions({
      // This check runs app-wide, so stop once the model is present instead of
      // stat-ing a multi-gigabyte file every second for the life of the app.
      // Download completion invalidates this query, so no update is missed.
      refetchInterval: (query) =>
        query.state.data?.status === "ok" && query.state.data.data === true
          ? false
          : 1000,
      queryKey: localLlmKeys.downloaded(model),
      queryFn: () => localLlmCommands.isModelDownloaded(model),
      select: (result) => {
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.data;
      },
    }),
  isDownloading: (model: GgufLlmModel) =>
    queryOptions({
      refetchInterval: 1000,
      queryKey: localLlmKeys.downloading(model),
      queryFn: () => localLlmCommands.isModelDownloading(model),
      select: (result) => {
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.data;
      },
    }),
  serverUrl: () =>
    queryOptions({
      queryKey: localLlmKeys.serverUrl(),
      queryFn: () => localLlmCommands.serverUrl(),
      select: (result) => {
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.data;
      },
      // The server can start on its own in the background (app-startup
      // auto-start), not just in response to this app's own `ensureStarted`
      // call — poll so the UI actually notices once it's up. Cheap local
      // command (in-memory check), fine to poll indefinitely rather than
      // relying on `query.state.data` truthiness to stop early — that's
      // the pre-`select` raw Result object, always truthy, so a
      // stop-when-truthy condition here would (and did) kill polling after
      // the very first fetch regardless of the actual URL.
      // Poll quickly while waiting for the server, then back off once its URL
      // is known; a crash is still noticed within ten seconds. The check reads
      // the raw Result's `data`, not its truthiness, for the reason above.
      refetchInterval: (query) =>
        query.state.data?.status === "ok" && query.state.data.data
          ? 10_000
          : 2000,
      staleTime: Infinity,
    }),
};

export function useLocalLlmModelDownload(
  model: GgufLlmModel = DEFAULT_LOCAL_LLM_MODEL,
) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDownloaded = useQuery(localLlmQueries.isDownloaded(model));
  const isDownloading = useQuery(localLlmQueries.isDownloading(model));

  const showProgress =
    !isDownloaded.data && (isStarting || (isDownloading.data ?? false));

  // Global broadcast, not tied to whoever's `Channel` triggered the
  // download — this is what makes progress visible here even when the
  // download was kicked off silently from app startup, not this button.
  useEffect(() => {
    const unlisten = localLlmEvents.downloadProgressPayload.listen((event) => {
      if (event.payload.model !== model) {
        return;
      }

      const { status } = event.payload;
      if (typeof status === "object" && "failed" in status) {
        setErrorMessage(status.failed);
        setIsStarting(false);
        setProgress(0);
      } else if (status === "completed") {
        setErrorMessage(null);
        setIsStarting(false);
        setProgress(100);
        void queryClient.invalidateQueries({
          queryKey: localLlmKeys.downloaded(model),
        });
      } else if (typeof status === "object" && "downloading" in status) {
        setErrorMessage(null);
        setIsStarting(false);
        setProgress(Math.max(0, Math.min(100, status.downloading)));
      }
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [model, queryClient]);

  const handleDownload = useCallback(() => {
    if (isDownloaded.data || isDownloading.data || isStarting) {
      return;
    }

    setErrorMessage(null);
    setIsStarting(true);
    setProgress(0);

    const channel = new Channel<number>();
    channel.onmessage = (value) => {
      // Real failure text arrives via `downloadProgressPayload` (the
      // `DownloadStatus::Failed(reason)` broadcast handled above) — don't
      // clobber it here with a generic message, since ordering between
      // this channel and that event isn't guaranteed.
      setIsStarting(false);
      setProgress(value < 0 ? 0 : value);
    };

    void localLlmCommands.downloadModel(model, channel).then((result) => {
      if (result.status === "error") {
        setErrorMessage(result.error);
        setIsStarting(false);
      }
    });
  }, [isDownloaded.data, isDownloading.data, isStarting, model]);

  const handleCancel = useCallback(() => {
    void localLlmCommands.cancelDownload(model);
    setIsStarting(false);
    setProgress(0);
  }, [model]);

  return {
    progress,
    hasError: errorMessage !== null,
    errorMessage,
    isDownloaded: isDownloaded.data ?? false,
    isDownloadedLoading: isDownloaded.isLoading,
    showProgress,
    handleDownload,
    handleCancel,
  };
}

export function useLocalLlmServer(
  model: GgufLlmModel = DEFAULT_LOCAL_LLM_MODEL,
) {
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const serverUrl = useQuery(localLlmQueries.serverUrl());

  const ensureStarted = useCallback(async () => {
    if (serverUrl.data) {
      return serverUrl.data;
    }
    if (isStarting) {
      return null;
    }

    setIsStarting(true);
    setStartError(null);
    try {
      const result = await localLlmCommands.startServer(model);
      if (result.status === "error") {
        setStartError(result.error);
        return null;
      }
      await queryClient.invalidateQueries({
        queryKey: localLlmKeys.serverUrl(),
      });
      return result.data;
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, model, queryClient, serverUrl.data]);

  return {
    url: serverUrl.data ?? null,
    isStarting,
    startError,
    ensureStarted,
  };
}
