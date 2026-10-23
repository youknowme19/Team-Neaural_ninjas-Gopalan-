use local_ip_address::local_ip;
use qrcode::render::svg;
use qrcode::QrCode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrCodeResponse {
    pub lan_url: String,
    pub qr_svg: String,
}

pub fn generate_broadcast_qr(port: u16) -> Result<QrCodeResponse, String> {
    let ip = local_ip().map_err(|e| format!("Failed to resolve local IP: {}", e))?;
    let lan_url = format!("http://{}:{}/broadcast", ip, port);

    let code = QrCode::new(lan_url.as_bytes())
        .map_err(|e| format!("Failed to generate QR code: {}", e))?;

    let svg_string = code
        .render::<svg::Color>()
        .min_dimensions(200, 200)
        .dark_color(svg::Color("#38bdf8")) // Tailwind Sky-400
        .light_color(svg::Color("transparent"))
        .build();

    Ok(QrCodeResponse {
        lan_url,
        qr_svg: svg_string,
    })
}
