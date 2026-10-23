'use client';

import { useState } from 'react';
import { AnnouncementBar } from '../components/layout/AnnouncementBar';
import { Navbar } from '../components/layout/Navbar';
import { HeroSection } from '../components/sections/HeroSection';
import { SpeedComparisonSection } from '../components/sections/SpeedComparisonSection';
import { ParallaxBlobs } from '../components/motion/ParallaxBlobs';

export default function Home() {
  const [activeMode, setActiveMode] = useState<'dictation' | 'live-events'>('dictation');

  return (
    <div className="relative min-h-screen bg-[#FAF8F4] overflow-x-hidden">
      {/* Background Parallax Blobs */}
      <ParallaxBlobs />

      {/* Main Structural Wrapper */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <AnnouncementBar />
        <Navbar activeMode={activeMode} onModeChange={setActiveMode} />
        <main className="flex-1 pb-20">
          <HeroSection />
          <SpeedComparisonSection />
        </main>
      </div>
    </div>
  );
}
