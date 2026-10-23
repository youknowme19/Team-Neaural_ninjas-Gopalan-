use crate::broadcast::qr::generate_qr_data_url;
use crate::broadcast::websocket::BroadcastHub;
use local_ip_address::local_ip;
use serde::Serialize;

#[derive(Serialize)]
pub struct BroadcastInfo {
    pub url: String,
    pub qr_data_url: String,
    pub connected_devices: usize,
}

#[tauri::command]
pub fn get_broadcast_info() -> Result<BroadcastInfo, String> {
    let ip = local_ip()
        .map(|addr| addr.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    let url = format!("http://{}:8080", ip);
    let qr_data_url = generate_qr_data_url(&url)?;
    let connected_devices = BroadcastHub::global().get_connected_clients();

    Ok(BroadcastInfo {
        url,
        qr_data_url,
        connected_devices,
    })
}
