import { useState } from 'react';

export function useAudioCapture() {
  const [isRecording, setIsRecording] = useState(false);
  return { isRecording, setIsRecording };
}
