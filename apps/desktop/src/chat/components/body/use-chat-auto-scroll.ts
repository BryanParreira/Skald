import type { ChatStatus } from "ai";
import { type WheelEvent, useEffect, useRef, useState } from "react";

export function useChatAutoScroll(status: ChatStatus) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousIsGeneratingRef = useRef(false);
  const pendingUserScrollIntentRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showGoToRecent, setShowGoToRecent] = useState(false);
  const isGenerating = status === "submitted" || status === "streaming";

  const scrollToBottom = () => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    shouldAutoScrollRef.current = true;
    pendingUserScrollIntentRef.current = false;
    setIsAtBottom(true);
    setShowGoToRecent(false);
  };

  // Streaming tokens can trigger the render-effect below and the
  // ResizeObserver within the same frame, each writing `scrollTop`
  // synchronously — that double (or rapid repeated) write is what reads as
  // glitchy/jittery scroll during fast local-model streaming. Coalesce any
  // burst of scroll requests into a single write per animation frame.
  const scheduleScrollToBottom = () => {
    if (scrollFrameRef.current !== null) {
      return;
    }
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;

      // Re-check at fire time rather than trusting the state that queued
      // this frame: the user can scroll up in between, and a queued frame
      // that still ran `scrollToBottom` would both yank them back down and
      // re-arm auto-scroll — which repeated every streamed token, making it
      // impossible to scroll up while a reply was generating.
      if (!shouldAutoScrollRef.current || pendingUserScrollIntentRef.current) {
        return;
      }

      if (!scrollRef.current) {
        return;
      }

      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const updateAutoScrollState = () => {
    if (!scrollRef.current) {
      return;
    }

    const { scrollTop, clientHeight, scrollHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const nextIsAtBottom = distanceFromBottom <= 24;
    setIsAtBottom(nextIsAtBottom);

    if (nextIsAtBottom) {
      shouldAutoScrollRef.current = true;
      pendingUserScrollIntentRef.current = false;
      setShowGoToRecent(false);
      return;
    }

    shouldAutoScrollRef.current = false;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY > 0 && !isAtBottom) {
      setShowGoToRecent(true);
      return;
    }

    if (event.deltaY < 0) {
      setShowGoToRecent(false);
    }

    if (!isGenerating || event.deltaY >= 0) {
      return;
    }

    pendingUserScrollIntentRef.current = true;
  };

  useEffect(() => {
    if (isGenerating && !previousIsGeneratingRef.current) {
      shouldAutoScrollRef.current = true;
      pendingUserScrollIntentRef.current = false;
      setShowGoToRecent(false);
    }

    previousIsGeneratingRef.current = isGenerating;

    if (shouldAutoScrollRef.current) {
      scheduleScrollToBottom();
    }
  });

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) {
        scheduleScrollToBottom();
      }
    });

    observer.observe(contentRef.current);

    return () => {
      observer.disconnect();
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  return {
    contentRef,
    isAtBottom,
    scrollRef,
    scrollToBottom,
    showGoToRecent,
    updateAutoScrollState,
    handleWheel,
  };
}
