"use client";

/**
 * LiveSpeak first-load intro: a 3D tunnel of caption cards you fly through.
 * - Covers the page as a fixed overlay, locks page scroll while it plays.
 * - Wheel / touch / arrow keys / space fly forward. If nobody scrolls, it
 *   auto-plays after 2.5s. "Skip intro" and Esc skip it.
 * - When the tunnel ends, the overlay fades out and normal page scrolling starts.
 * - Plays once per browser session (add ?intro to the URL to force it).
 * - Skipped entirely for prefers-reduced-motion.  then Integrate the intro animation for the LiveSpeak site.
 *
 * Emits window event "livespeak:intro" with detail "play" | "done" so a smooth-scroll
 * library (Lenis) can pause/resume. See the integration notes.
 *
 * Needs: framer-motion. Optional: LiveSpeakLogo.tsx (for the mark in the centre).
 */

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveSpeakMark } from "@/components/LiveSpeakLogo";

const STORAGE_KEY = "livespeak-intro-seen";

/* ------------------------------------------------------------------ */
/* Card content: product moments instead of stock photos               */
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
        Um, so I <s className="text-rose-500/80">uh</s> think we should <s className="text-rose-500/80">like</s> ship it
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

/* ------------------------------------------------------------------ */
/* Tunnel geometry (from the 21st.dev perspective-tunnel component)    */
/* ------------------------------------------------------------------ */

interface TunnelCardData {
  content: CardContent;
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
}

const TUNNEL_CARDS: TunnelCardData[] = CARDS.map((content, i) => {
  const goldenAngle = i * 137.5 * (Math.PI / 180);
  return {
    content,
    angleCos: Math.cos(goldenAngle),
    angleSin: Math.sin(goldenAngle),
    radiusFactorX: 0.28 + (i % 3) * 0.08,
    radiusFactorY: 0.26 + (i % 2) * 0.09,
    rotationZ: (i % 2 === 0 ? 1 : -1) * (2 + (i % 4) * 1.5),
    index: i,
  };
});

const SPRING_CONFIG = { stiffness: 60, damping: 25, mass: 0.5 };

interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

function CardBody({ content }: { content: CardContent }) {
  const label = (
    <span className="text-xs sm:text-[13px] text-neutral-500">{content.label}</span>
  );

  switch (content.kind) {
    case "caption":
      return (
        <>
          {label}
          <p className="text-base sm:text-xl leading-snug text-neutral-900">
            {content.done}
            {content.partial && <span className="italic text-neutral-400">{content.partial}</span>}
          </p>
        </>
      );
    case "stat":
      return (
        <>
          {label}
          <div>
            <p className="text-3xl sm:text-5xl font-semibold tracking-tight text-neutral-900">{content.value}</p>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500">{content.note}</p>
          </div>
        </>
      );
    case "mono":
      return (
        <>
          {label}
          <div>
            <p className="font-mono text-sm sm:text-base text-neutral-900 break-all">{content.value}</p>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500">{content.note}</p>
          </div>
        </>
      );
    case "diff":
      return (
        <>
          {label}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-neutral-400">{content.raw}</p>
            <p className="text-sm sm:text-lg leading-snug text-neutral-900">{content.clean}</p>
          </div>
        </>
      );
  }
}

interface TunnelCardProps {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
}

function TunnelCard({ card, progress, pointer, total, stage }: TunnelCardProps) {
  const staggerSpan = 0.55;
  const start = (card.index / total) * (1 - staggerSpan);
  const end = start + staggerSpan;

  const localProgress = useTransform(progress, [start, end], [0, 1]);

  const farZ = stage.isMobile ? -1200 : -1700;
  const nearZ = stage.isMobile ? 350 : 500;
  const z = useTransform(localProgress, [0, 1], [farZ, nearZ]);
  const opacity = useTransform(localProgress, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);

  const cardWidth = stage.isMobile
    ? Math.max(170, Math.min(230, stage.width * 0.5))
    : Math.max(220, Math.min(320, stage.width * 0.21));

  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const panStrength = stage.isMobile ? 20 : 45;

  const transform = useTransform([z, pointer.x, pointer.y], ([currZ, px, py]: number[]) => {
    const offsetX = baseX - px * panStrength;
    const offsetY = baseY - py * panStrength;
    return `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${currZ}px) rotateZ(${card.rotationZ}deg)`;
  });

  return (
    <motion.div
      style={{ width: cardWidth, transform, opacity, zIndex: card.index + 1 }}
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-[5/4] will-change-transform select-none"
    >
      <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-white p-4 sm:p-5 ring-1 ring-black/10 shadow-xl shadow-black/10">
        <CardBody content={card.content} />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* The overlay                                                         */
/* ------------------------------------------------------------------ */

type Phase = "checking" | "playing" | "leaving" | "done";

export default function IntroTunnel() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [stage, setStage] = useState<StageDimensions>({ width: 1440, height: 900, isMobile: false });

  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, { stiffness: 80, damping: 30, restDelta: 0.0001 });

  // camera parallax
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointer = { x: useSpring(rawX, SPRING_CONFIG), y: useSpring(rawY, SPRING_CONFIG) };

  const emit = (detail: "play" | "done") =>
    window.dispatchEvent(new CustomEvent("livespeak:intro", { detail }));

  const leave = useCallback(() => {
    setPhase((p) => (p === "playing" ? "leaving" : p));
  }, []);

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

  // safety: never leave the page locked if the component unmounts mid-intro
  useEffect(() => () => { document.documentElement.style.overflow = ""; }, []);

  // 3. Stage size
  useEffect(() => {
    const update = () =>
      setStage({ width: window.innerWidth, height: window.innerHeight, isMobile: window.innerWidth < 768 });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 4. Input: wheel, touch, keys, pointer parallax (purely driven by user scroll)
  useEffect(() => {
    if (phase !== "playing") return;

    const bump = (d: number) => {
      rawProgress.set(Math.min(1, Math.max(0, rawProgress.get() + d)));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation(); // keep Lenis / page from seeing it
      bump(e.deltaY * 0.0008);
    };
    let lastY = 0;
    const onTouchStart = (e: TouchEvent) => { lastY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      bump((lastY - y) * 0.003);
      lastY = y;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { rawProgress.set(1); return; }
      if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); bump(0.08); }
      if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); bump(-0.08); }
    };
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
    };
  }, [phase, rawProgress, rawX, rawY]);

  // 5. End of tunnel -> fade out
  useEffect(
    () => smoothProgress.on("change", (v) => { if (v > 0.985) leave(); }),
    [smoothProgress, leave]
  );

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [0.8, 1, 1.25]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.1, 0.8, 0.97], [0.3, 1, 1, 0]);
  const hintOpacity = useTransform(smoothProgress, [0, 0.1], [1, 0]);

  if (phase === "done") return null;

  return (
    <motion.div
      role="dialog"
      aria-label="LiveSpeak intro animation"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#FAF8F4] text-neutral-900"
      style={{ perspective: stage.isMobile ? "900px" : "1200px", touchAction: "none" }}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "leaving" ? 0 : 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => { if (phase === "leaving") setPhase("done"); }}
    >
      {/* centre title */}
      <motion.div
        style={{ scale: titleScale, opacity: titleOpacity }}
        className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center"
      >
        <LiveSpeakMark size={48} />
        <h1 className="mt-6 text-6xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-7xl md:text-8xl text-neutral-900">
          LiveSpeak
        </h1>
        <p className="mt-4 text-base sm:text-xl text-neutral-500 font-medium">
          Don&rsquo;t wait, just watch it appear.
        </p>
      </motion.div>

      {/* 3D card plane */}
      <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {TUNNEL_CARDS.map((card) => (
          <TunnelCard
            key={card.index}
            card={card}
            progress={smoothProgress}
            pointer={pointer}
            total={TUNNEL_CARDS.length}
            stage={stage}
          />
        ))}
      </div>

      {/* hint + skip */}
      <motion.p
        style={{ opacity: hintOpacity }}
        className="pointer-events-none absolute bottom-8 left-1/2 z-[200] -translate-x-1/2 text-sm text-neutral-500"
      >
        Scroll to enter
      </motion.p>
      <button
        type="button"
        onClick={() => { rawProgress.set(1); }}
        className="absolute bottom-6 right-6 z-[200] rounded-full px-4 py-2 text-sm text-neutral-600 ring-1 ring-black/10 transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      >
        Skip intro
      </button>
    </motion.div>
  );
}
