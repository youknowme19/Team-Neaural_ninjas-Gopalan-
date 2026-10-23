export type TokenSource = "mic" | "window";
export type TokenType = "partial" | "final";

export interface TokenPayload {
  type: TokenType;
  text: string;
  source: TokenSource;
  timestamp_ms: number;
}

export interface TranscriptSentence {
  id: string;
  text: string;
  source: TokenSource;
  timestamp: number;
}
