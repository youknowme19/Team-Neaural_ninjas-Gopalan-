'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { wordMaskVariant } from './MotionVariants';

interface WordByWordHeadlineProps {
  regularPhrase: string;
  italicPhrase: string;
  className?: string;
}

export function WordByWordHeadline({
  regularPhrase,
  italicPhrase,
  className = '',
}: WordByWordHeadlineProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <h1 className={className}>
        {regularPhrase} <span className="font-serif italic font-normal text-on-surface-variant">{italicPhrase}</span>
      </h1>
    );
  }

  const regularWords = regularPhrase.split(' ');
  const italicWords = italicPhrase.split(' ');

  return (
    <motion.h1
      className={className}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.06, delayChildren: 0.15 }}
    >
      {regularWords.map((word, i) => (
        <span key={`reg-${i}`} className="inline-block overflow-hidden mr-[0.28em] align-top">
          <motion.span variants={wordMaskVariant} className="inline-block">
            {word}
          </motion.span>
        </span>
      ))}
      {italicWords.map((word, j) => (
        <span key={`ita-${j}`} className="inline-block overflow-hidden mr-[0.28em] align-top">
          <motion.span
            variants={wordMaskVariant}
            className="inline-block font-serif italic font-normal text-on-surface-variant"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </motion.h1>
  );
}
