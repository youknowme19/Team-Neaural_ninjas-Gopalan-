export type AudioSourceType = 'mic' | 'window' | 'system';

export type TokenType = 'PARTIAL' | 'FINAL';

export interface TranscriptItem {
  id: string;
  type: TokenType;
  text: string;
  source: 'mic' | 'window';
  timestamp: number;
}

export interface StreamTokenPayload {
  token_type: TokenType;
  text: string;
  source: 'mic' | 'window';
}
