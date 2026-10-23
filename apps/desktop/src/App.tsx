import { WidgetView } from './routes/WidgetView';
import { BroadcastView } from './routes/BroadcastView';

export default function App() {
  const isBroadcast = window.location.pathname.includes('/broadcast') || window.location.search.includes('view=broadcast');

  return (
    <div className="w-full h-full">
      {isBroadcast ? <BroadcastView /> : <WidgetView />}
    </div>
  );
}
