use crate::broadcast::qr::generate_qr_data_url;
use local_ip_address::local_ip;
use serde::Serialize;

#[derive(Serialize)]
pub struct BroadcastInfo {
    pub url: String,
    pub qr_data_url: String,
}

#[tauri::command]
pub fn get_broadcast_info() -> Result<BroadcastInfo, String> {
    let ip = local_ip().map_err(|e| e.to_string())?;
    let url = format!("http://{}:8080/broadcast", ip);
    let qr_data_url = generate_qr_data_url(&url)?;

    Ok(BroadcastInfo { url, qr_data_url })
}
