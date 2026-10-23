'use client';

import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

export function ParallaxBlobs() {
  const { scrollY } = useScroll();
  const shouldReduceMotion = useReducedMotion();

  const yBlob1 = useTransform(scrollY, [0, 1000], [0, 120]);
  const yBlob2 = useTransform(scrollY, [0, 1000], [0, -160]);
  const yBlob3 = useTransform(scrollY, [0, 1000], [0, 90]);

  if (shouldReduceMotion) {
    return (
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-16 -left-20 w-80 md:w-[32rem] h-80 md:h-[32rem] rounded-full bg-[#FFDDD2] opacity-45 blur-[90px] md:blur-[120px]" />
        <div className="absolute top-72 -right-24 w-96 md:w-[36rem] h-96 md:h-[36rem] rounded-full bg-[#E8DEFF] opacity-40 blur-[100px] md:blur-[130px]" />
        <div className="absolute top-[48rem] left-8 w-72 md:w-[28rem] h-72 md:h-[28rem] rounded-full bg-[#D8F3DC] opacity-50 blur-[85px] md:blur-[110px]" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Peach Blob (0.12x scroll) */}
      <motion.div
        style={{ y: yBlob1 }}
        className="absolute -top-16 -left-20 w-80 md:w-[32rem] h-80 md:h-[32rem] rounded-full bg-[#FFDDD2] opacity-45 blur-[90px] md:blur-[120px]"
      />
      {/* Lilac Blob (0.16x scroll) */}
      <motion.div
        style={{ y: yBlob2 }}
        className="absolute top-72 -right-24 w-96 md:w-[36rem] h-96 md:h-[36rem] rounded-full bg-[#E8DEFF] opacity-40 blur-[100px] md:blur-[130px]"
      />
      {/* Mint Soft Blob (0.09x scroll) */}
      <motion.div
        style={{ y: yBlob3 }}
        className="absolute top-[48rem] left-8 w-72 md:w-[28rem] h-72 md:h-[28rem] rounded-full bg-[#D8F3DC] opacity-50 blur-[85px] md:blur-[110px]"
      />
    </div>
  );
}
