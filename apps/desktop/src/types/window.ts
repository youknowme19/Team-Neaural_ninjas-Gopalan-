export interface ActiveWindow {
  window_name: String;
  process_id: number;
  app_name: string;
}

export interface QrCodeResponse {
  lan_url: string;
  qr_svg: string;
}
