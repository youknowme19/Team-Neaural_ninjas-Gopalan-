import React from "react";
import { WidgetView } from "./routes/WidgetView";
import { BroadcastView } from "./routes/BroadcastView";

export const App: React.FC = () => {
  const isBroadcastRoute =
    window.location.pathname === "/broadcast" ||
    window.location.search.includes("mode=broadcast");

  if (isBroadcastRoute) {
    return <BroadcastView />;
  }

  return (
    <main className="w-screen h-screen flex items-center justify-center bg-transparent">
      <WidgetView />
    </main>
  );
};

export default App;
