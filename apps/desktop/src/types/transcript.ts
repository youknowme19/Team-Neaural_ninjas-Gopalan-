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

export type GrammarProviderType = 'local' | 'groq';

export interface CleanTranscriptRequest {
  raw_text: string;
  provider?: GrammarProviderType;
  groq_api_key?: string;
  groq_model?: string;
  local_model_path?: string;
  local_binary_path?: string;
}

export interface CleanTranscriptResponse {
  cleaned_text: string;
  provider_used: string;
  latency_ms: number;
  original_length: number;
  cleaned_length: number;
}
