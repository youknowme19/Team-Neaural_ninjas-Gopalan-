use std::sync::Arc;
use tauri::State;
use crate::broadcast::qr::{generate_broadcast_qr, QrCodeResponse};
use crate::broadcast::websocket::start_websocket_server;
use crate::state::AppState;

#[tauri::command]
pub async fn start_broadcast(state: State<'_, Arc<AppState>>) -> Result<QrCodeResponse, String> {
    if !state.is_broadcasting() {
        state.set_broadcasting(true);
        let state_clone = (*state).clone();
        tokio::spawn(async move {
            start_websocket_server(state_clone, 8080).await;
        });
    }

    generate_broadcast_qr(8080)
}

#[tauri::command]
pub fn stop_broadcast(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    state.set_broadcasting(false);
    Ok(false)
}

#[tauri::command]
pub fn get_broadcast_qr() -> Result<QrCodeResponse, String> {
    generate_broadcast_qr(8080)
}
