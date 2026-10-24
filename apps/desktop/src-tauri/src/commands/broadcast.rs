use crate::broadcast::qr::generate_qr_data_url;
use crate::broadcast::websocket::BroadcastHub;
use serde::Serialize;
use std::net::UdpSocket;

#[derive(Serialize)]
pub struct BroadcastInfo {
    pub url: String,
    pub qr_data_url: String,
    pub connected_devices: usize,
}

/// Discovers the true physical Wi-Fi/LAN IP address that mobile devices on the same network can access,
/// filtering out virtual adapters (WSL, Hyper-V, Docker, VMware, VPNs).
pub fn get_best_lan_ip() -> String {
    // 1. Query the OS kernel routing table for the outbound gateway interface
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                let ip = local_addr.ip().to_string();
                if ip != "0.0.0.0" && !ip.starts_with("127.") && !ip.starts_with("169.254.") && !ip.starts_with("172.17.") {
                    return ip;
                }
            }
        }
    }

    // 2. Fallback: inspect physical network adapters, strictly ignoring virtual ones
    if let Ok(interfaces) = local_ip_address::list_afinet_netifas() {
        for (name, ip) in &interfaces {
            let n = name.to_lowercase();
            if (n.contains("wi-fi") || n.contains("wireless") || n.contains("wlan") || n.contains("ethernet"))
                && !n.contains("vethernet")
                && !n.contains("virtual")
                && !n.contains("wsl")
                && !n.contains("vpn")
                && !n.contains("bluetooth")
            {
                if let std::net::IpAddr::V4(ipv4) = ip {
                    if !ipv4.is_loopback() && !ipv4.is_link_local() {
                        return ipv4.to_string();
                    }
                }
            }
        }

        for (name, ip) in &interfaces {
            let n = name.to_lowercase();
            if !n.contains("vethernet") && !n.contains("wsl") && !n.contains("docker") && !n.contains("virtual") {
                if let std::net::IpAddr::V4(ipv4) = ip {
                    let s = ipv4.to_string();
                    if s.starts_with("192.168.") || s.starts_with("10.") {
                        return s;
                    }
                }
            }
        }
    }

    local_ip_address::local_ip()
        .map(|addr| addr.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

#[tauri::command]
pub fn get_broadcast_info() -> Result<BroadcastInfo, String> {
    let ip = get_best_lan_ip();
    let url = format!("http://{}:8080", ip);
    let qr_data_url = generate_qr_data_url(&url)?;
    let connected_devices = BroadcastHub::global().get_connected_clients();

    Ok(BroadcastInfo {
        url,
        qr_data_url,
        connected_devices,
    })
}
