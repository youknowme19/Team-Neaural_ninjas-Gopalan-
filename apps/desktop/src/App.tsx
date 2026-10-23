import React from 'react';
import { WidgetView } from './routes/WidgetView';
import { BroadcastView } from './routes/BroadcastView';
import { CaptionOverlayView } from './routes/CaptionOverlayView';

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');
  const pathname = window.location.pathname;

  if (view === 'overlay' || pathname.includes('/overlay')) {
    return <CaptionOverlayView />;
  }

  if (view === 'broadcast' || pathname.includes('/broadcast')) {
    return <BroadcastView />;
  }

  return <WidgetView />;
}
