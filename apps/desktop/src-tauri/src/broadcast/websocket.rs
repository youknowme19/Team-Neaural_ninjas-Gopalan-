use std::net::SocketAddr;
use std::sync::Arc;
use futures_util::SinkExt;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use crate::state::AppState;

pub async fn start_websocket_server(state: Arc<AppState>, port: u16) {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind WebSocket server to {}: {}", addr, e);
            return;
        }
    };

    println!("LiveSpeak WebSocket Broadcaster listening on ws://{}", addr);

    while let Ok((stream, client_addr)) = listener.accept().await {
        let mut rx = state.broadcast_channel.subscribe();

        tokio::spawn(async move {
            let mut ws_stream = match accept_async(stream).await {
                Ok(ws) => ws,
                Err(e) => {
                    eprintln!("WebSocket handshake error from {}: {}", client_addr, e);
                    return;
                }
            };

            while let Ok(payload) = rx.recv().await {
                if let Ok(json_string) = serde_json::to_string(&payload) {
                    if let Err(_) = ws_stream.send(Message::Text(json_string)).await {
                        break;
                    }
                }
            }
        });
    }
}
