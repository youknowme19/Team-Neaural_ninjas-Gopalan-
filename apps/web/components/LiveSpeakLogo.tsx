import * as React from "react";

type AnimateMode = "always" | "hover" | "off";

type MarkProps = {
  /** Height of the mark in px */
  size?: number;
  animate?: AnimateMode;
  color?: string;
  className?: string;
};

// Geometry traced from the logo PNG (viewBox 308 x 260).
// lo/hi = how far each bar shrinks/grows (scaleY) while "speaking".
const BARS = [
  { x: 0, y: 115, h: 77, lo: 0.55, hi: 1.9, dur: 0.95, delay: -0.2 },
  { x: 72, y: 61, h: 161, lo: 0.45, hi: 1.4, dur: 1.15, delay: -0.7 },
  { x: 145, y: 5, h: 247, lo: 0.5, hi: 1.0, dur: 1.3, delay: -0.4 },
  { x: 218, y: 67, h: 125, lo: 0.5, hi: 1.7, dur: 1.05, delay: -0.9 },
];

const CSS = `
.lsm-bar{transform-box:fill-box;transform-origin:center;animation:lsm-pulse var(--dur) ease-in-out var(--delay) infinite}
.lsm-caret{animation:lsm-blink 1.06s step-end infinite}
.lsm[data-animate="hover"] .lsm-bar,.lsm[data-animate="hover"] .lsm-caret{animation-play-state:paused}
.lsm[data-animate="hover"]:hover .lsm-bar,.lsm[data-animate="hover"]:hover .lsm-caret{animation-play-state:running}
.lsm[data-animate="off"] .lsm-bar,.lsm[data-animate="off"] .lsm-caret{animation:none}
@keyframes lsm-pulse{0%,100%{transform:scaleY(var(--lo))}50%{transform:scaleY(var(--hi))}}
@keyframes lsm-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.lsm-bar,.lsm-caret{animation:none!important}}
`;

export function LiveSpeakMark({
  size = 40,
  animate = "always",
  color = "#3B2FD0",
  className,
}: MarkProps) {
  return (
    <>
      <style>{CSS}</style>
      <svg
        className={`lsm ${className ?? ""}`}
        data-animate={animate}
        viewBox="0 0 308 260"
        height={size}
        width={(size * 308) / 260}
        role="img"
        aria-label="LiveSpeak"
        overflow="visible"
      >
        {BARS.map((b, i) => (
          <rect
            key={i}
            className="lsm-bar"
            x={b.x}
            y={b.y}
            width={48}
            height={b.h}
            rx={24}
            fill={color}
            style={
              {
                "--lo": b.lo,
                "--hi": b.hi,
                "--dur": `${b.dur}s`,
                "--delay": `${b.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* text caret: the "live typing" cue */}
        <rect className="lsm-caret" x={292} y={22} width={16} height={212} fill={color} />
      </svg>
    </>
  );
}

type LogoProps = MarkProps & {
  /** Text colour of the wordmark */
  textColor?: string;
};

export function LiveSpeakLogo({
  size = 36,
  animate = "always",
  color = "#3B2FD0",
  textColor = "#111111",
  className,
}: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}
    >
      <LiveSpeakMark size={size} animate={animate} color={color} />
      <span
        style={{
          fontSize: size * 0.88,
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          color: textColor,
        }}
      >
        LiveSpeak
      </span>
    </span>
  );
}

export default LiveSpeakLogo;
