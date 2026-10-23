use qrcode::render::svg;
use qrcode::QrCode;
use base64::{engine::general_purpose::STANDARD, Engine as _};

pub fn generate_qr_data_url(data: &str) -> Result<String, String> {
    let code = QrCode::new(data.as_bytes()).map_err(|e| e.to_string())?;
    let image = code.render::<svg::Color>().build();
    let encoded = STANDARD.encode(image.as_bytes());
    Ok(format!("data:image/svg+xml;base64,{}", encoded))
}
