'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Activity, Download, Radio, Mic } from 'lucide-react';

interface NavbarProps {
  activeMode: 'dictation' | 'live-events';
  onModeChange: (mode: 'dictation' | 'live-events') => void;
}

export function Navbar({ activeMode, onModeChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#FAF8F4]/80 backdrop-blur-md border-b border-black/[0.06] transition-all">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
            <Activity className="w-5 h-5 text-pastel-mint" />
          </div>
          <span className="font-sans font-extrabold text-xl sm:text-2xl tracking-tight text-primary">
            LiveSpeak
          </span>
        </a>

        {/* Centered Pill Mode Switcher (Desktop) */}
        <div className="hidden md:flex items-center bg-surface-container-low border border-outline-subtle p-1 rounded-full shadow-sm">
          <button
            type="button"
            onClick={() => onModeChange('dictation')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
              activeMode === 'dictation'
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-secondary" />
            Dictation Mode
          </button>
          <button
            type="button"
            onClick={() => onModeChange('live-events')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
              activeMode === 'live-events'
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-secondary" />
            Live Events
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <motion.a
            href="#download"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-sm hover:shadow-md transition-shadow group"
          >
            <Download className="w-4 h-4 text-pastel-mint" />
            <span>Download</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </motion.a>
        </div>
      </div>
    </header>
  );
}
