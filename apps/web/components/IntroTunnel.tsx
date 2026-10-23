"use client";

/**
 * LiveSpeak first-load intro: a waveform card row that undulates and slides with scroll.
 * - Covers the page as a fixed overlay, locks page scroll while it plays.
 * - Wheel / touch / arrow keys / space fly forward. If nobody scrolls, it
 *   auto-plays after 2.5s. "Skip intro" and Esc skip it.
 * - Pointer drag on the overlay moves the row 1:1.
 * - When the intro ends, the overlay fades out and normal page scrolling starts.
 * - Plays once per browser session (add ?intro to the URL to force it).
 * - Skipped entirely for prefers-reduced-motion.
 * - Emits window event "livespeak:intro" with detail "play" | "done".
 * - Black and white only (#FFFFFF, #111111, #737373, #A3A3A3).
 */

import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LiveSpeakMark } from "@/components/LiveSpeakLogo";

const STORAGE_KEY = "livespeak-intro-seen";

/* ------------------------------------------------------------------ */
/* Card content                                                       */
/* ------------------------------------------------------------------ */

type CardContent =
  | { kind: "caption"; label: string; done: string; partial?: string }
  | { kind: "stat"; label: string; value: string; note: string }
  | { kind: "mono"; label: string; value: string; note: string }
  | { kind: "diff"; label: string; raw: React.ReactNode; clean: string };

const CARDS: CardContent[] = [
  { kind: "caption", label: "Live caption", done: "Let's move the launch ", partial: "to Mon" },
  { kind: "stat", label: "Partial text", value: "<350 ms", note: "from voice to screen" },
  { kind: "mono", label: "Audience mode", value: "192.168.1.45:8080", note: "Scan the QR code, read along on your phone" },
  {
    kind: "diff",
    label: "Clean up",
    raw: (
      <>
        Um, so I <s className="line-through text-[#737373]">uh</s> think we should <s className="line-through text-[#737373]">like</s> ship it
      </>
    ),
    clean: "So I think we should ship it.",
  },
  { kind: "stat", label: "Network", value: "0", note: "outbound connections" },
  { kind: "caption", label: "System audio", done: "Welcome to the keynote, ", partial: "today we're" },
  { kind: "stat", label: "Install size", value: "<200 MB", note: "app, engine and model" },
  { kind: "caption", label: "OBS overlay", done: "Questions go in the chat." },
  { kind: "stat", label: "Final text", value: "<800 ms", note: "per sentence" },
];

interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

function CardBody({ content, isDark }: { content: CardContent; isDark: boolean }) {
  const labelColor = isDark ? "text-[#A3A3A3]" : "text-[#737373]";
  const textColor = isDark ? "text-[#FFFFFF]" : "text-[#111111]";
  const subColor = isDark ? "text-[#A3A3A3]" : "text-[#737373]";

  const label = (
    <span className={`text-[11px] sm:text-xs font-medium uppercase tracking-wider ${labelColor}`}>
      {content.label}
    </span>
  );

  switch (content.kind) {
    case "caption":
      return (
        <div className="flex flex-col justify-between h-full">
          {label}
          <p className={`text-sm sm:text-lg leading-snug font-medium ${textColor}`}>
            {content.done}
            {content.partial && (
              <span className={`italic ${isDark ? "text-[#737373]" : "text-[#A3A3A3]"}`}>
                {content.partial}
              </span>
            )}
          </p>
          <div />
        </div>
      );
    case "stat":
      return (
        <div className="flex flex-col justify-between h-full">
          {label}
          <div>
            <p className={`text-2xl sm:text-4xl font-bold tracking-tight ${textColor}`}>{content.value}</p>
            <p className={`mt-1 text-[11px] sm:text-xs ${subColor}`}>{content.note}</p>
          </div>
          <div />
        </div>
      );
    case "mono":
      return (
        <div className="flex flex-col justify-between h-full">
          {label}
          <div>
            <p className={`font-mono text-xs sm:text-sm break-all font-semibold ${textColor}`}>{content.value}</p>
            <p className={`mt-1 text-[11px] sm:text-xs ${subColor}`}>{content.note}</p>
          </div>
          <div />
        </div>
      );
    case "diff":
      return (
        <div className="flex flex-col justify-between h-full">
          {label}
          <div className="space-y-1 sm:space-y-2">
            <p className={`text-xs ${isDark ? "text-[#737373]" : "text-[#737373]"}`}>{content.raw}</p>
            <p className={`text-xs sm:text-base leading-snug font-medium ${textColor}`}>{content.clean}</p>
          </div>
          <div />
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Waveform Card Component                                             */
/* ------------------------------------------------------------------ */

interface WaveformCardProps {
  content: CardContent;
  index: number;
  progress: MotionValue<number>;
  stage: StageDimensions;
  cardWidth: number;
  pitch: number;
  N: number;
}

function WaveformCard({
  content,
  index,
  progress,
  stage,
  cardWidth,
  pitch,
  N,
}: WaveformCardProps) {
  const isDark = index % 2 !== 0; // even cards are white, odd cards are #111 black

  const W = stage.width;
  const H = stage.height;
  const rowCenterY = H * 0.62;
  const waveAmplitude = stage.isMobile ? H * 0.06 : H * 0.12;

  // Total travel distance: W * 1.1 + (N - 1) * pitch + W * 0.2
  const totalTravel = W * 1.1 + (N - 1) * pitch + W * 0.2;

  // Transform hook computed per frame
  const transform = useTransform(progress, (p) => {
    // rowX(progress) = W * 1.1 - progress * totalTravel
    const rowX = W * 1.1 - p * totalTravel;
    const cardCenterX = rowX + index * pitch;

    // normalized distance from screen center (-1 to 1 across viewport)
    const d = (cardCenterX - W / 2) / (W / 2);

    // scale: 0.42 + 1.1 * exp(-(d * d) / 0.12)
    const scale = 0.42 + 1.1 * Math.exp(-(d * d) / 0.12);

    // undulation wave: sin(d * 3.2 + progress * 6) * amplitude
    const y = Math.sin(d * 3.2 + p * 6) * waveAmplitude;

    // rotate: d * 6 degrees
    const rotate = d * 6;

    const posX = cardCenterX - cardWidth / 2;
    const posY = rowCenterY + y - (cardWidth * 0.8) / 2;

    return `translate3d(${posX}px, ${posY}px, 0px) scale(${scale}) rotate(${rotate}deg)`;
  });

  const opacity = useTransform(progress, (p) => {
    const rowX = W * 1.1 - p * totalTravel;
    const cardCenterX = rowX + index * pitch;
    const absD = Math.abs((cardCenterX - W / 2) / (W / 2));

    // Smoothstep fade out when |d| > 1.15
    if (absD >= 1.25) return 0;
    if (absD <= 0.95) return 1;
    const t = (1.25 - absD) / (1.25 - 0.95);
    return t * t * (3 - 2 * t);
  });

  const zIndex = useTransform(progress, (p) => {
    const rowX = W * 1.1 - p * totalTravel;
    const cardCenterX = rowX + index * pitch;
    const d = (cardCenterX - W / 2) / (W / 2);
    const scale = 0.42 + 1.1 * Math.exp(-(d * d) / 0.12);
    return Math.round(scale * 100);
  });

  const boxShadow = useTransform(progress, (p) => {
    const rowX = W * 1.1 - p * totalTravel;
    const cardCenterX = rowX + index * pitch;
    const d = (cardCenterX - W / 2) / (W / 2);
    const scale = 0.42 + 1.1 * Math.exp(-(d * d) / 0.12);
    if (scale > 1.2) {
      return "0 20px 40px -10px rgba(0, 0, 0, 0.22), 0 10px 20px -5px rgba(0, 0, 0, 0.12)";
    }
    return "none";
  });

  return (
    <motion.div
      style={{
        width: cardWidth,
        transform,
        opacity,
        zIndex,
      }}
      className="pointer-events-none absolute left-0 top-0 aspect-[5/4] will-change-transform select-none"
    >
      <motion.div
        style={{ boxShadow }}
        className={`flex h-full w-full flex-col justify-between rounded-2xl p-4 sm:p-5 transition-colors duration-150 ${
          isDark
            ? "bg-[#111111] text-white border-0"
            : "bg-white text-[#111111] border border-[#111111]"
        }`}
      >
        <CardBody content={content} isDark={isDark} />
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* The Overlay                                                         */
/* ------------------------------------------------------------------ */

type Phase = "checking" | "playing" | "leaving" | "done";

export default function IntroTunnel() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [stage, setStage] = useState<StageDimensions>({ width: 1440, height: 900, isMobile: false });
  const [isDragging, setIsDragging] = useState(false);

  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, { stiffness: 80, damping: 30, restDelta: 0.0001 });

  const autoRef = useRef<AnimationPlaybackControls | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; progress: number } | null>(null);

  const emit = (detail: "play" | "done") =>
    window.dispatchEvent(new CustomEvent("livespeak:intro", { detail }));

  const leave = useCallback(() => {
    setPhase((p) => (p === "playing" ? "leaving" : p));
  }, []);

  // Geometry parameters
  const cardWidth = stage.isMobile ? 150 : 210;
  const pitch = 1.15 * cardWidth;
  const N = CARDS.length;
  const totalTravel = stage.width * 1.1 + (N - 1) * pitch + stage.width * 0.2;

  // 1. Decide whether to play
  useEffect(() => {
    const force = new URLSearchParams(window.location.search).has("intro");
    const seen = sessionStorage.getItem(STORAGE_KEY) === "1";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!force && (seen || reduced)) {
      setPhase("done");
      return;
    }
    setPhase("playing");
  }, []);

  // 2. Lock scroll while playing, release when done
  useEffect(() => {
    if (phase === "playing") {
      document.documentElement.style.overflow = "hidden";
      emit("play");
    }
    if (phase === "done") {
      document.documentElement.style.overflow = "";
      sessionStorage.setItem(STORAGE_KEY, "1");
      window.scrollTo(0, 0);
      emit("done");
    }
  }, [phase]);

  // Safety cleanup
  useEffect(() => () => { document.documentElement.style.overflow = ""; }, []);

  // 3. Stage size
  useEffect(() => {
    const update = () =>
      setStage({ width: window.innerWidth, height: window.innerHeight, isMobile: window.innerWidth < 768 });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Helper to stop auto-play timer
  const stopAuto = useCallback(() => {
    if (autoRef.current) {
      autoRef.current.stop();
      autoRef.current = null;
    }
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
  }, []);

  // 4. Input: wheel, touch, keyboard, drag, and auto-play
  useEffect(() => {
    if (phase !== "playing") return;

    const bump = (d: number) => {
      stopAuto();
      rawProgress.set(Math.min(1, Math.max(0, rawProgress.get() + d)));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      bump(e.deltaY * 0.0008);
    };

    let lastTouchX = 0;
    const onTouchStart = (e: TouchEvent) => {
      stopAuto();
      lastTouchX = e.touches[0].clientX;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const currentX = e.touches[0].clientX;
      const deltaX = currentX - lastTouchX;
      bump(-deltaX / totalTravel);
      lastTouchX = currentX;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAuto();
        rawProgress.set(1);
        return;
      }
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        bump(0.08);
      }
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        bump(-0.08);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);

    // 2.5s auto-play if no input
    idleRef.current = setTimeout(() => {
      autoRef.current = animate(rawProgress, 1, { duration: 9, ease: "easeInOut" });
    }, 2500);

    return () => {
      stopAuto();
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, rawProgress, totalTravel, stopAuto]);

  // Pointer Drag handlers (1:1 drag with grab / grabbing cursor)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== "playing") return;
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).closest("button")) return;
    stopAuto();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      progress: rawProgress.get(),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const newProgress = dragStartRef.current.progress + -deltaX / totalTravel;
    rawProgress.set(Math.min(1, Math.max(0, newProgress)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // 5. End of wave -> fade out
  useEffect(
    () => smoothProgress.on("change", (v) => { if (v > 0.985) leave(); }),
    [smoothProgress, leave]
  );

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [0.95, 1, 1.05]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.1, 0.85, 0.97], [0.5, 1, 1, 0]);
  const hintOpacity = useTransform(smoothProgress, [0, 0.12], [1, 0]);

  if (phase === "done") return null;

  return (
    <motion.div
      role="dialog"
      aria-label="LiveSpeak intro animation"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-[#FFFFFF] text-[#111111] select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{ touchAction: "none" }}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "leaving" ? 0 : 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => { if (phase === "leaving") setPhase("done"); }}
    >
      {/* Title & Logo: Upper third (top: 14% of the screen height) */}
      <motion.div
        style={{
          top: "14%",
          scale: titleScale,
          opacity: titleOpacity,
        }}
        className="pointer-events-none absolute left-0 right-0 z-10 flex flex-col items-center px-6 text-center"
      >
        <LiveSpeakMark size={44} color="#111111" />
        <h1 className="mt-5 text-4xl sm:text-6xl md:text-7xl font-bold leading-[0.95] tracking-[-0.04em] text-[#111111]">
          LiveSpeak
        </h1>
        <p className="mt-3 text-sm sm:text-lg text-[#737373] font-medium tracking-tight">
          Don&rsquo;t wait, just watch it appear.
        </p>
      </motion.div>

      {/* Waveform Card Row */}
      <div className="pointer-events-none absolute inset-0">
        {CARDS.map((card, i) => (
          <WaveformCard
            key={i}
            content={card}
            index={i}
            progress={smoothProgress}
            stage={stage}
            cardWidth={cardWidth}
            pitch={pitch}
            N={N}
          />
        ))}
      </div>

      {/* Hint */}
      <motion.p
        style={{ opacity: hintOpacity }}
        className="pointer-events-none absolute bottom-8 left-1/2 z-[200] -translate-x-1/2 text-xs sm:text-sm font-medium tracking-wide text-[#737373]"
      >
        Scroll or drag to explore
      </motion.p>

      {/* Skip Intro button (neutral gray) */}
      <button
        type="button"
        onClick={() => {
          stopAuto();
          rawProgress.set(1);
        }}
        className="absolute bottom-6 right-6 z-[200] rounded-full px-4 py-2 text-xs sm:text-sm font-medium text-[#737373] hover:text-[#111111] border border-[#111111]/20 hover:border-[#111111]/50 bg-white transition-all cursor-pointer shadow-sm"
      >
        Skip intro
      </button>
    </motion.div>
  );
}
