import React from 'react';

export const HeroSection = () => (
  <section className="text-center py-16">
    <span className="text-xs uppercase tracking-widest text-indigo-400 font-mono bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
      100% On-Device • Rust Native • Zero Cloud
    </span>
    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mt-6 mb-4">
      LiveSpeak
    </h1>
    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
      Ultra-low-latency live speech-to-text desktop application with app-specific audio target locking, zero-latency speaker diarization, and LAN audience broadcasting.
    </p>
  </section>
);
