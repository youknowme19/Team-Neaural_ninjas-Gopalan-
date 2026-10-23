'use client';

import { motion } from 'framer-motion';

export function AnnouncementBar() {
  return (
    <aside className="w-full bg-surface-container-low/80 backdrop-blur-sm border-b border-outline-variant/30 px-4 py-2 flex items-center justify-center relative z-20">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex items-center gap-2 bg-surface-container-lowest/90 px-3.5 py-1 rounded-full shadow-sm border border-outline-variant/30 text-xs sm:text-sm"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-mint opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
        </span>
        <span className="font-semibold text-on-surface tracking-wide">
          <span className="text-secondary font-bold mr-1">V0.1.0 RELEASE</span> · On-device · Under 200 MB
        </span>
      </motion.div>
    </aside>
  );
}
