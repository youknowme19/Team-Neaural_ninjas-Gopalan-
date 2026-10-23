'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { 
  Download, 
  Play, 
  RotateCcw, 
  Copy, 
  Check, 
  Mic, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu
} from 'lucide-react';
import { WordByWordHeadline } from '../motion/WordByWordHeadline';
import { fadeUpVariant } from '../motion/MotionVariants';

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  
  // Animation stage:
  // 0: Typing raw text
  // 1: Highlighting fillers (pink)
  // 2: Striking through and collapsing fillers, fading in punctuation
  // 3: Clean state with chips ('Filler removed', 'Punctuation added')
  const [stage, setStage] = useState<number>(3);
  const [typedIndex, setTypedIndex] = useState<number>(60);
  const [isManualPaused, setIsManualPaused] = useState(false);

  const fullRawText = "Umm, so I think we should like move the launch to uh Monday...";
  const cleanFinalText = "So I think we should move the launch to Monday.";

  useEffect(() => {
    if (shouldReduceMotion || isManualPaused) {
      setStage(3);
      setTypedIndex(fullRawText.length);
      return;
    }

    let timer: NodeJS.Timeout;

    // Loop cycle (~8s total)
    if (stage === 0) {
      // Typing phase
      if (typedIndex < fullRawText.length) {
        timer = setTimeout(() => {
          setTypedIndex((prev) => prev + 1);
        }, 35);
      } else {
        timer = setTimeout(() => {
          setStage(1); // highlight fillers
        }, 600);
      }
    } else if (stage === 1) {
      timer = setTimeout(() => {
        setStage(2); // strike and collapse
      }, 1200);
    } else if (stage === 2) {
      timer = setTimeout(() => {
        setStage(3); // clean result + chips
      }, 1000);
    } else if (stage === 3) {
      timer = setTimeout(() => {
        setTypedIndex(0);
        setStage(0); // restart loop
      }, 4000);
    }

    return () => clearTimeout(timer);
  }, [stage, typedIndex, shouldReduceMotion, isManualPaused]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanFinalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const restartDemo = () => {
    setIsManualPaused(false);
    setTypedIndex(0);
    setStage(0);
  };

  return (
    <section className="relative pt-8 sm:pt-14 pb-16 sm:pb-24 px-4 sm:px-6 max-w-[1200px] mx-auto z-10 flex flex-col items-center text-center">
      {/* Eyebrow Pill */}
      <motion.div
        variants={fadeUpVariant}
        initial="hidden"
        animate="visible"
        className="inline-flex items-center gap-2 bg-white/90 border border-black/[0.08] px-3.5 sm:px-4 py-1.5 rounded-full shadow-sm mb-6"
      >
        <span className="w-2 h-2 rounded-full bg-secondary-mint animate-pulse" />
        <span className="font-sans font-bold text-xs sm:text-sm text-secondary tracking-wide">
          On-device · No cloud · Under 200 MB
        </span>
      </motion.div>

      {/* Main Headline with Serif-Italic Accent */}
      <div className="max-w-4xl mx-auto mb-6">
        <WordByWordHeadline
          regularPhrase="Don't wait,"
          italicPhrase="just watch it appear."
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-primary leading-[1.08]"
        />
      </div>

      {/* Subtext */}
      <motion.p
        variants={fadeUpVariant}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
        className="text-base sm:text-xl text-on-surface-variant max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-normal"
      >
        Live speech-to-text that runs 100% on your machine. Sub-second captions, clean
        grammar, and broadcast to OBS or your audience&apos;s phones.
      </motion.p>

      {/* Dual CTAs */}
      <motion.div
        variants={fadeUpVariant}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto mb-3"
      >
        <motion.a
          href="#download"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-primary text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all group"
        >
          <Download className="w-4 h-4 text-pastel-mint" />
          <span>Download for free</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </motion.a>

        <motion.button
          type="button"
          onClick={restartDemo}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 border border-black/[0.08] text-primary font-bold text-sm sm:text-base px-6 py-3.5 rounded-full shadow-sm hover:bg-surface-container-low transition-all"
        >
          {stage === 3 ? (
            <>
              <RotateCcw className="w-4 h-4 text-secondary" />
              <span>Replay Demo</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-secondary fill-secondary" />
              <span>Playing Morph...</span>
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Availability sub-caption */}
      <motion.p
        variants={fadeUpVariant}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.35 }}
        className="text-xs sm:text-sm text-on-surface-variant font-medium mb-12"
      >
        Available for Apple Silicon and Windows (x64 / ARM64)
      </motion.p>

      {/* Large Rounded "Raw -> Polished" Demo Card */}
      <motion.div
        variants={fadeUpVariant}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
        whileHover={{ y: -4 }}
        className="w-full max-w-4xl bg-white rounded-card p-5 sm:p-8 border border-black/[0.06] shadow-card hover:shadow-card-hover transition-all duration-300 text-left relative overflow-hidden"
      >
        {/* Card Header & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary-rose" />
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
              LIVE CAPTURE STREAM
            </span>
            <span className="hidden sm:inline-block text-xs bg-secondary-soft text-secondary font-semibold px-2 py-0.5 rounded-full">
              On-Device CoreML / DirectML
            </span>
          </div>

          {/* Equalizer animation */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-medium hidden sm:inline">
              Input Signal
            </span>
            <div className="flex items-center gap-1 h-5 px-2 py-1 bg-surface-container-low rounded-full">
              {[18, 10, 22, 14, 20, 8].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-secondary rounded-full animate-pulse"
                  style={{
                    height: `${h}px`,
                    animationDelay: `${i * 150}ms`,
                    animationDuration: '900ms',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Live Transformation Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-6">
          {/* Upper Compartment: Raw Messy Speech */}
          <div className="bg-surface-container-low/70 rounded-2xl p-4 sm:p-5 border border-black/[0.05] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5 uppercase tracking-wide">
                  <Mic className="w-3.5 h-3.5 text-secondary" />
                  Raw Speech Input
                </span>
                <span className="text-[11px] font-mono text-on-surface-variant bg-white/80 px-2 py-0.5 rounded border border-black/[0.04]">
                  whisper.cpp tiny.en
                </span>
              </div>

              {/* Dynamic Transcript with Pink Fillers */}
              <p className="text-sm sm:text-base leading-relaxed text-on-surface font-sans">
                {stage === 0 ? (
                  <>
                    &ldquo;{fullRawText.slice(0, typedIndex)}
                    <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                    &rdquo;
                  </>
                ) : (
                  <>
                    &ldquo;
                    <span
                      className={`transition-all duration-300 ${
                        stage >= 1
                          ? 'bg-[#FCECEF] text-[#C95D73] px-1.5 py-0.5 rounded-md font-semibold text-xs border border-dashed border-[#C95D73]'
                          : ''
                      } ${stage >= 2 ? 'line-through opacity-40' : ''}`}
                    >
                      Umm,
                    </span>{' '}
                    so I think we should{' '}
                    <span
                      className={`transition-all duration-300 ${
                        stage >= 1
                          ? 'bg-[#FCECEF] text-[#C95D73] px-1.5 py-0.5 rounded-md font-semibold text-xs border border-dashed border-[#C95D73]'
                          : ''
                      } ${stage >= 2 ? 'line-through opacity-40' : ''}`}
                    >
                      like
                    </span>{' '}
                    move the launch to{' '}
                    <span
                      className={`transition-all duration-300 ${
                        stage >= 1
                          ? 'bg-[#FCECEF] text-[#C95D73] px-1.5 py-0.5 rounded-md font-semibold text-xs border border-dashed border-[#C95D73]'
                          : ''
                      } ${stage >= 2 ? 'line-through opacity-40' : ''}`}
                    >
                      uh
                    </span>{' '}
                    Monday...&rdquo;
                  </>
                )}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-black/[0.04] flex items-center justify-between text-xs text-on-surface-variant font-mono">
              <span>Latency: 280ms</span>
              <span className="text-rose-600 font-semibold">3 Fillers Detected</span>
            </div>
          </div>

          {/* Lower Compartment: Clean Polished Output */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-secondary/20 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-pastel-mintSoft rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-secondary flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />
                  Synthesized Output
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-surface-container-low hover:bg-surface-container-high text-primary px-3 py-1 rounded-full transition-colors active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-secondary" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Polished Text */}
              <p className="text-sm sm:text-base leading-relaxed text-primary font-medium">
                {stage < 2 ? (
                  <span className="text-on-surface-variant italic">
                    Synthesizing clean punctuation and context...
                  </span>
                ) : (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    &ldquo;{cleanFinalText}&rdquo;
                  </motion.span>
                )}
              </p>
            </div>

            {/* Chips: Filler Removed, Punctuation Added */}
            <div className="mt-4 pt-3 border-t border-black/[0.04] flex flex-wrap items-center gap-2">
              {stage >= 2 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#FCECEF] text-[#C95D73] px-2.5 py-1 rounded-full border border-[#C95D73]/20"
                >
                  <Sparkles className="w-3 h-3" />
                  Filler removed
                </motion.span>
              )}
              {stage >= 3 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-secondary-soft text-secondary px-2.5 py-1 rounded-full border border-secondary/20"
                >
                  <Check className="w-3 h-3" />
                  Punctuation added
                </motion.span>
              )}
              <span className="text-[11px] text-on-surface-variant font-mono ml-auto">
                0 cloud calls
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry Footer Bar */}
        <div className="mt-5 pt-4 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-mint" />
            <span className="font-bold text-primary">Neural Engine Active</span>
            <span className="text-black/[0.2]">|</span>
            <span>Qwen 2.5 0.5B (4-bit quantized)</span>
          </div>

          <div className="flex items-center gap-4 font-mono font-medium">
            <span className="flex items-center gap-1 text-secondary">
              <Zap className="w-3.5 h-3.5" />
              &lt; 350ms
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" />
              170 MB RAM
            </span>
            <span className="flex items-center gap-1 text-primary font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
              Offline
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
