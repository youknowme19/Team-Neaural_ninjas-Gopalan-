"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface PricingCardProps {
  label: string;
  monthlyPrice: string;
  description: string;
  cta: string;
  href: string;
  bgColor: string;
  accentColor: string;
  BGComponent: React.ComponentType;
}

export const SquishyPricing = () => {
  return (
    <section id="pricing" style={{ padding: '16px', textAlign: 'center' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto 48px' }}>
        <span style={{
          display: 'inline-block',
          borderRadius: '9999px',
          background: '#FFFFFF',
          padding: '4px 14px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#1C1917',
          border: '1px solid rgba(28,25,23,0.12)',
          marginBottom: '14px'
        }}>
          Pricing Plans
        </span>
        <h2 style={{
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: '#1C1917',
          marginBottom: '12px',
          lineHeight: 1.15
        }}>
          Private speech-to-text, priced simply.
        </h2>
        <p style={{ fontSize: '17px', color: '#57534E', lineHeight: 1.6 }}>
          LiveSpeak runs on your machine. Start free, add live event broadcasting, or talk to us about studio seats.
        </p>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '24px',
        maxWidth: '1100px',
        margin: '0 auto'
      }}>
        <PricingCard
          label="Edge"
          monthlyPrice="0"
          description="On-device dictation with tiny.en, sub-second captions, and zero cloud audio."
          cta="Download Free"
          href="#download"
          bgColor="#1C1917"
          accentColor="rgba(255,255,255,0.12)"
          BGComponent={BGComponent1}
        />
        <PricingCard
          label="Live Events"
          monthlyPrice="0"
          description="OBS transparent overlays plus QR audience captions over local Wi-Fi."
          cta="Download Free"
          href="#download"
          bgColor="#3B2F6E"
          accentColor="rgba(255,255,255,0.10)"
          BGComponent={BGComponent2}
        />
        <PricingCard
          label="Studio"
          monthlyPrice="—"
          description="base.en, grammar cleanup, and multi-seat licenses for production teams."
          cta="Get Early Access"
          href="#download"
          bgColor="#064E30"
          accentColor="rgba(255,255,255,0.10)"
          BGComponent={BGComponent3}
        />
      </div>
    </section>
  );
};

export const Component = SquishyPricing;

const PricingCard = ({
  label,
  monthlyPrice,
  description,
  cta,
  href,
  bgColor,
  BGComponent,
}: PricingCardProps) => {
  const isCustom = monthlyPrice === "—";

  return (
    <motion.div
      whileHover="hover"
      transition={{ duration: 0.9, ease: "backInOut" }}
      variants={{ hover: { scale: 1.04 } }}
      style={{
        position: 'relative',
        height: '384px',
        width: '300px',
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: '20px',
        padding: '32px',
        backgroundColor: bgColor,
        boxShadow: '0 20px 50px -10px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start'
      }}
    >
      {/* Text content */}
      <div style={{ position: 'relative', zIndex: 10, color: '#FFFFFF' }}>
        <span style={{
          display: 'inline-block',
          marginBottom: '12px',
          borderRadius: '9999px',
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(6px)',
          padding: '3px 12px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {label}
        </span>

        <motion.div
          initial={{ scale: 0.88 }}
          variants={{ hover: { scale: 1 } }}
          transition={{ duration: 0.9, ease: "backInOut" }}
          style={{
            fontFamily: 'monospace',
            fontSize: '58px',
            fontWeight: 900,
            lineHeight: 1.15,
            marginBottom: '12px',
            color: '#FFFFFF',
            transformOrigin: 'top left'
          }}
        >
          {isCustom ? (
            <>Custom<br />seats</>
          ) : (
            <>${monthlyPrice}/<br />Month</>
          )}
        </motion.div>

        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.88)', lineHeight: 1.55 }}>
          {description}
        </p>
      </div>

      {/* CTA button — anchored to bottom */}
      <a
        href={href}
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          right: '16px',
          zIndex: 20,
          borderRadius: '12px',
          border: '2px solid #FFFFFF',
          background: '#FFFFFF',
          padding: '10px 0',
          textAlign: 'center',
          fontFamily: 'monospace',
          fontWeight: 900,
          textTransform: 'uppercase',
          fontSize: '13px',
          color: '#1C1917',
          textDecoration: 'none',
          letterSpacing: '0.04em',
          transition: 'background 0.2s ease, color 0.2s ease',
          cursor: 'pointer',
          display: 'block'
        }}
        onMouseEnter={e => {
          (e.target as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.12)';
          (e.target as HTMLAnchorElement).style.color = '#FFFFFF';
        }}
        onMouseLeave={e => {
          (e.target as HTMLAnchorElement).style.background = '#FFFFFF';
          (e.target as HTMLAnchorElement).style.color = '#1C1917';
        }}
      >
        {cta}
      </a>

      {/* Background decoration */}
      <BGComponent />
    </motion.div>
  );
};

const BGComponent1 = () => (
  <motion.svg
    width="320" height="384" viewBox="0 0 320 384" fill="none"
    xmlns="http://www.w3.org/2000/svg"
    variants={{ hover: { scale: 1.5 } }}
    transition={{ duration: 0.9, ease: "backInOut" }}
    style={{ position: 'absolute', inset: 0, zIndex: 0 }}
  >
    <motion.circle
      variants={{ hover: { scaleY: 0.5, y: -25 } }}
      transition={{ duration: 0.9, ease: "backInOut", delay: 0.2 }}
      cx="160.5" cy="114.5" r="101.5"
      fill="rgba(255,255,255,0.07)"
    />
    <motion.ellipse
      variants={{ hover: { scaleY: 2.25, y: -25 } }}
      transition={{ duration: 0.9, ease: "backInOut", delay: 0.2 }}
      cx="160.5" cy="265.5" rx="101.5" ry="43.5"
      fill="rgba(255,255,255,0.07)"
    />
  </motion.svg>
);

const BGComponent2 = () => (
  <motion.svg
    width="320" height="384" viewBox="0 0 320 384" fill="none"
    xmlns="http://www.w3.org/2000/svg"
    variants={{ hover: { scale: 1.05 } }}
    transition={{ duration: 0.9, ease: "backInOut" }}
    style={{ position: 'absolute', inset: 0, zIndex: 0 }}
  >
    <motion.rect
      x="14" width="153" height="153" rx="15"
      fill="rgba(255,255,255,0.07)"
      variants={{ hover: { y: 219, rotate: '90deg', scaleX: 2 } }}
      style={{ y: 12 }}
      transition={{ delay: 0.2, duration: 0.9, ease: "backInOut" }}
    />
    <motion.rect
      x="155" width="153" height="153" rx="15"
      fill="rgba(255,255,255,0.07)"
      variants={{ hover: { y: 12, rotate: '90deg', scaleX: 2 } }}
      style={{ y: 219 }}
      transition={{ delay: 0.2, duration: 0.9, ease: "backInOut" }}
    />
  </motion.svg>
);

const BGComponent3 = () => (
  <motion.svg
    width="320" height="384" viewBox="0 0 320 384" fill="none"
    xmlns="http://www.w3.org/2000/svg"
    variants={{ hover: { scale: 1.25 } }}
    transition={{ duration: 0.9, ease: "backInOut" }}
    style={{ position: 'absolute', inset: 0, zIndex: 0 }}
  >
    <motion.path
      variants={{ hover: { y: -50 } }}
      transition={{ delay: 0.3, duration: 0.9, ease: "backInOut" }}
      d="M148.893 157.531C154.751 151.673 164.249 151.673 170.107 157.531L267.393 254.818C273.251 260.676 273.251 270.173 267.393 276.031L218.75 324.674C186.027 357.397 132.973 357.397 100.25 324.674L51.6068 276.031C45.7489 270.173 45.7489 260.676 51.6068 254.818L148.893 157.531Z"
      fill="rgba(255,255,255,0.07)"
    />
    <motion.path
      variants={{ hover: { y: -50 } }}
      transition={{ delay: 0.2, duration: 0.9, ease: "backInOut" }}
      d="M148.893 99.069C154.751 93.2111 164.249 93.2111 170.107 99.069L267.393 196.356C273.251 202.213 273.251 211.711 267.393 217.569L218.75 266.212C186.027 298.935 132.973 298.935 100.25 266.212L51.6068 217.569C45.7489 211.711 45.7489 202.213 51.6068 196.356L148.893 99.069Z"
      fill="rgba(255,255,255,0.07)"
    />
    <motion.path
      variants={{ hover: { y: -50 } }}
      transition={{ delay: 0.1, duration: 0.9, ease: "backInOut" }}
      d="M148.893 40.6066C154.751 34.7487 164.249 34.7487 170.107 40.6066L267.393 137.893C273.251 143.751 273.251 153.249 267.393 159.106L218.75 207.75C186.027 240.473 132.973 240.473 100.25 207.75L51.6068 159.106C45.7489 153.249 45.7489 143.751 51.6068 137.893L148.893 40.6066Z"
      fill="rgba(255,255,255,0.07)"
    />
  </motion.svg>
);

export default SquishyPricing;
