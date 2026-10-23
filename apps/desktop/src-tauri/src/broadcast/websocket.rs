use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

pub struct WebSocketBroadcaster {
    sender: broadcast::Sender<String>,
}

impl WebSocketBroadcaster {
    pub fn new() -> (Self, broadcast::Receiver<String>) {
        let (tx, rx) = broadcast::channel(100);
        (Self { sender: tx }, rx)
    }

    pub fn broadcast(&self, message: String) {
        let _ = self.sender.send(message);
    }

    pub async fn run_server(addr: &str, rx: broadcast::Sender<String>) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(addr).await?;
        log::info!("Live caption WebSocket broadcaster listening on ws://{}", addr);

        while let Ok((stream, _)) = listener.accept().await {
            let tx = rx.clone();
            tokio::spawn(handle_connection(stream, tx));
        }

        Ok(())
    }
}

async fn handle_connection(stream: TcpStream, tx: broadcast::Sender<String>) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            log::error!("WebSocket connection error: {}", e);
            return;
        }
    };

    let (mut write, _) = ws_stream.split();
    let mut rx = tx.subscribe();

    while let Ok(msg) = rx.recv().await {
        if write.send(Message::Text(msg)).await.is_err() {
            break;
        }
    }
}
