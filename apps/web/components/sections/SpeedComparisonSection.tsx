'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Zap, Clock, Cpu, Activity, Keyboard, Sparkles } from 'lucide-react';
import { WordByWordHeadline } from '../motion/WordByWordHeadline';
import { fadeUpVariant } from '../motion/MotionVariants';

export function SpeedComparisonSection() {
  const shouldReduceMotion = useReducedMotion();

  // Animated counters and typing states
  const [isInView, setIsInView] = useState(false);
  const [typingWpm, setTypingWpm] = useState(0);
  const [liveSpeakWpm, setLiveSpeakWpm] = useState(0);

  const [typingText, setTypingText] = useState('');
  const [liveSpeakText, setLiveSpeakText] = useState('');

  const fullTypingSample = "The quick brown fox jumps over the lazy dog and pauses to correct errors... ";
  const fullLiveSpeakSample = "Instantaneous conversational stream with sub-second partial tokens, zero cloud round-trips, and automatic punctuation locked in.";

  // Counter and typing animation when in view
  useEffect(() => {
    if (!isInView) return;

    if (shouldReduceMotion) {
      setTypingWpm(45);
      setLiveSpeakWpm(185);
      setTypingText(fullTypingSample);
      setLiveSpeakText(fullLiveSpeakSample);
      return;
    }

    // Animate typing WPM counter to 45
    let wpm1 = 0;
    const interval1 = setInterval(() => {
      wpm1 += 1;
      if (wpm1 >= 45) {
        setTypingWpm(45);
        clearInterval(interval1);
      } else {
        setTypingWpm(wpm1);
      }
    }, 30);

    // Animate LiveSpeak WPM counter to 185
    let wpm2 = 0;
    const interval2 = setInterval(() => {
      wpm2 += 4;
      if (wpm2 >= 185) {
        setLiveSpeakWpm(185);
        clearInterval(interval2);
      } else {
        setLiveSpeakWpm(wpm2);
      }
    }, 20);

    // Typewriter slow effect for Typing card (45 wpm = ~70ms per char)
    let idx1 = 0;
    const typeTimer1 = setInterval(() => {
      idx1++;
      if (idx1 <= fullTypingSample.length) {
        setTypingText(fullTypingSample.slice(0, idx1));
      } else {
        idx1 = 0; // loop
      }
    }, 75);

    // Typewriter fast effect for LiveSpeak card (185 wpm = ~20ms per char)
    let idx2 = 0;
    const typeTimer2 = setInterval(() => {
      idx2 += 2;
      if (idx2 <= fullLiveSpeakSample.length) {
        setLiveSpeakText(fullLiveSpeakSample.slice(0, idx2));
      } else {
        idx2 = 0; // loop
      }
    }, 30);

    return () => {
      clearInterval(interval1);
      clearInterval(interval2);
      clearInterval(typeTimer1);
      clearInterval(typeTimer2);
    };
  }, [isInView, shouldReduceMotion]);

  const techBadges = [
    { name: 'whisper.cpp', desc: 'GGUF Engine', color: '#EA580C' },
    { name: 'Tauri v2', desc: 'Native Host (15MB)', color: '#7C3AED' },
    { name: 'Apple CoreML', desc: 'M-Series ANE', color: '#1C1917' },
    { name: 'Windows DirectML', desc: 'DirectX 12 NPU', color: '#2563EB' },
    { name: 'Silero VAD', desc: 'ONNX Voice Slicer', color: '#059669' },
    { name: 'Rust Tokio', desc: 'Lock-Free Buffer', color: '#C2410C' },
  ];

  const statChips = [
    {
      metric: '< 350ms',
      label: 'partial text',
      desc: 'Tentative words appear on screen immediately as speech begins',
      accentColor: '#1C1917',
      bgGlow: 'from-amber-500/5',
    },
    {
      metric: '< 800ms',
      label: 'final text',
      desc: 'Local grammar and acoustic context committed with punctuation',
      accentColor: '#36684F',
      bgGlow: 'from-emerald-500/5',
    },
    {
      metric: '< 1.5s',
      label: 'cold start',
      desc: 'Instant background daemon ready on hotkey with zero cloud wake-up delay',
      accentColor: '#7C3AED',
      bgGlow: 'from-purple-500/5',
    },
  ];

  return (
    <section className="relative pt-10 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-6 max-w-[1200px] mx-auto z-10">
      {/* 1. Tech Logo Strip: "Built on open foundations" */}
      <motion.div
        variants={fadeUpVariant}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="text-center mb-16 sm:mb-24"
      >
        <p className="text-xs sm:text-sm font-bold tracking-widest text-on-surface-variant uppercase mb-6">
          Built on open foundations · Engineered for bare-metal speed
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
          {techBadges.map((tech, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -2, scale: 1.02 }}
              className="bg-white/95 border border-black/[0.07] px-4 py-2 sm:px-5 sm:py-2.5 rounded-full flex items-center gap-2.5 shadow-sm hover:shadow transition-all"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tech.color }}
              />
              <span className="text-xs sm:text-sm font-bold text-primary">
                {tech.name}
              </span>
              <span className="text-[11px] sm:text-xs text-on-surface-variant font-medium">
                {tech.desc}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 2. Speed Section Header */}
      <motion.div
        onViewportEnter={() => setIsInView(true)}
        viewport={{ once: true, amount: 0.2 }}
        className="text-center mb-12 sm:mb-16"
      >
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-2 bg-white/90 border border-black/[0.08] px-3.5 py-1.5 rounded-full shadow-sm mb-4">
          <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
          <span className="font-sans font-bold text-xs sm:text-sm text-secondary tracking-wide">
            Real-Time Sliding Window Architecture
          </span>
        </div>

        {/* Headline */}
        <div className="max-w-3xl mx-auto mb-4">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-primary leading-[1.12]">
            Captions in{' '}
            <span className="font-serif italic font-normal text-on-surface-variant">
              under a second.
            </span>
          </h2>
        </div>

        {/* Subtext */}
        <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          Human typing caps out at 45 words per minute with fatigue and errors.
          LiveSpeak streams continuous conversational speech directly into your active window.
        </p>
      </motion.div>

      {/* 3. Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto mb-12 sm:mb-16">
        {/* Left Card: "Typing" (45 wpm) */}
        <motion.div
          variants={fadeUpVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-card p-6 sm:p-8 border border-black/[0.06] shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                <span className="font-bold text-sm sm:text-base text-on-surface tracking-wide">
                  Typing
                </span>
              </div>
              <span className="font-mono font-bold text-xs text-stone-600 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                {typingWpm} WPM
              </span>
            </div>

            <div className="bg-[#FAF8F4] rounded-2xl p-4 sm:p-5 border border-black/[0.05] min-h-[140px] flex flex-col justify-between">
              <p className="font-mono text-sm leading-relaxed text-stone-600">
                {typingText}
                <span className="inline-block w-1.5 h-4 bg-stone-500 ml-0.5 align-middle animate-pulse" />
              </p>

              <div className="mt-4 pt-3 border-t border-black/[0.04] flex items-center justify-between text-xs text-stone-500 font-mono">
                <span>Speed: 0.75 words/sec</span>
                <span>Latency: ~1,330ms/word</span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-stone-50 rounded-xl border border-stone-200/60 text-xs text-stone-600 leading-relaxed flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-stone-500 shrink-0" />
            <span>Limited by physical typing speed, spelling slips, and manual corrections.</span>
          </div>
        </motion.div>

        {/* Right Card: "LiveSpeak" (180+ wpm with dynamic Framer Motion Waveform) */}
        <motion.div
          variants={fadeUpVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          whileHover={{ y: -4 }}
          className="bg-white rounded-card p-6 sm:p-8 border border-secondary/30 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
        >
          {/* Subtle gradient background accent */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-pastel-lilac/40 to-pastel-mint/30 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-mint opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary" />
                </span>
                <span className="font-bold text-sm sm:text-base text-primary tracking-wide">
                  LiveSpeak
                </span>
              </div>
              <span className="font-mono font-bold text-xs text-secondary bg-secondary-soft px-3 py-1 rounded-full border border-secondary/20">
                {liveSpeakWpm}+ WPM STREAMING
              </span>
            </div>

            <div className="bg-gradient-to-b from-[#F5FBF8] to-white rounded-2xl p-4 sm:p-5 border border-secondary/20 min-h-[140px] flex flex-col justify-between shadow-xs">
              <p className="font-sans text-sm sm:text-base font-semibold leading-relaxed text-primary">
                {liveSpeakText}
                <span className="inline-block w-1.5 h-4 bg-secondary ml-0.5 align-middle animate-pulse" />
              </p>

              {/* Framer Motion Dynamic Waveform Bars */}
              <div className="mt-4 pt-3 border-t border-black/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-1 h-6">
                  {[12, 22, 14, 28, 18, 30, 16, 26, 32, 14, 24, 18, 28, 12, 20, 26, 16].map((h, idx) => (
                    <motion.span
                      key={idx}
                      className="w-1 bg-secondary rounded-full"
                      animate={
                        shouldReduceMotion
                          ? { height: `${h}px` }
                          : {
                              height: [
                                `${Math.max(6, h * 0.4)}px`,
                                `${h}px`,
                                `${Math.max(6, h * 0.6)}px`,
                              ],
                            }
                      }
                      transition={{
                        duration: 0.8 + (idx % 4) * 0.15,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'easeInOut',
                        delay: (idx * 0.05) % 0.5,
                      }}
                    />
                  ))}
                </div>

                <span className="text-xs text-secondary font-mono font-semibold">
                  Zero Latency Lag
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-secondary-soft rounded-xl border border-secondary/20 text-xs text-secondary font-medium leading-relaxed flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary shrink-0" />
            <span>Overlapping 3-second audio windows stepped every 500ms for continuous streaming.</span>
          </div>
        </motion.div>
      </div>

      {/* 4. Three Stat Chips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 max-w-5xl mx-auto">
        {statChips.map((chip, idx) => (
          <motion.div
            key={idx}
            variants={fadeUpVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            whileHover={{ y: -4 }}
            className={`bg-white rounded-card p-6 sm:p-7 border border-black/[0.06] shadow-card hover:shadow-card-hover transition-all duration-300 text-center relative overflow-hidden bg-gradient-to-b ${chip.bgGlow} to-white`}
          >
            <div className="flex flex-col items-center">
              <span
                className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2 font-sans"
                style={{ color: chip.accentColor }}
              >
                {chip.metric}
              </span>
              <span className="text-sm font-bold uppercase tracking-wider text-primary mb-2">
                {chip.label}
              </span>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {chip.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
