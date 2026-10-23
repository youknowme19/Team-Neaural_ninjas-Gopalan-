import React from 'react';
import { GlassContainer } from '../components/GlassContainer';

export const WidgetView: React.FC = () => {
  return (
    <GlassContainer>
      <div className="flex-1 flex flex-col justify-between">
        <div className="text-center text-xs text-slate-400">
          Native LiveSpeak Desktop Widget View
        </div>
      </div>
    </GlassContainer>
  );
};
