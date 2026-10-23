import React from 'react';
import { HeroSection } from './components/HeroSection';
import { DesktopDemoMock } from './components/DesktopDemoMock';
import { DownloadMatrix } from './components/DownloadMatrix';
import { ArchitectureDeepDive } from './components/ArchitectureDeepDive';
import { LiveEventBroadcastDemo } from './components/LiveEventBroadcastDemo';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24 max-w-7xl mx-auto">
      <HeroSection />
      <DesktopDemoMock />
      <LiveEventBroadcastDemo />
      <DownloadMatrix />
      <ArchitectureDeepDive />
    </main>
  );
}
