//! LAT1 criterion 2: the warm-up at key-down opens the connection, sends no
//! key, audio or text, and the cleanup call after it reuses that connection
//! (a counting TCP server: one accepted connection for both requests).

#![allow(clippy::unwrap_used, reason = "test helpers fail the test on purpose")]

use std::sync::{Arc, Mutex};

use dictation_ports::{Cleaner, Secret};
use dictation_transcribe::engine::Engine;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const KEY: &str = "sk-or-v1-NOT-A-REAL-KEY-lat1-0123456789";

const REPLY: &str = r#"{"provider":"InferenceNet","choices":[{"message":{"content":"Hello."},"finish_reason":"stop"}]}"#;

/// Serves keep-alive HTTP/1.1; returns the connection count and each
/// request's head (lowercased).
async fn serve() -> (String, Arc<Mutex<usize>>, Arc<Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}/api/v1", listener.local_addr().unwrap());
    let connections = Arc::new(Mutex::new(0));
    let heads = Arc::new(Mutex::new(Vec::new()));
    let (c, h) = (Arc::clone(&connections), Arc::clone(&heads));
    tokio::spawn(async move {
        loop {
            let (mut stream, _) = listener.accept().await.unwrap();
            *c.lock().unwrap() += 1;
            let h = Arc::clone(&h);
            tokio::spawn(async move {
                let mut buf = Vec::new();
                loop {
                    let mut chunk = [0_u8; 4096];
                    let Ok(n) = stream.read(&mut chunk).await else {
                        return;
                    };
                    if n == 0 {
                        return;
                    }
                    buf.extend_from_slice(&chunk[..n]);
                    // One request per read is enough for this client.
                    let text = String::from_utf8_lossy(&buf).to_lowercase();
                    let Some(end) = text.find("\r\n\r\n") else {
                        continue;
                    };
                    let length = text[..end]
                        .lines()
                        .find_map(|l| l.strip_prefix("content-length: "))
                        .and_then(|v| v.trim().parse::<usize>().ok())
                        .unwrap_or(0);
                    if buf.len() < end + 4 + length {
                        continue;
                    }
                    h.lock().unwrap().push(text[..end].to_owned());
                    buf.clear();
                    let body = if text.starts_with("head") { "" } else { REPLY };
                    let response = format!(
                        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{body}",
                        body.len()
                    );
                    if stream.write_all(response.as_bytes()).await.is_err() {
                        return;
                    }
                }
            });
        }
    });
    (base, connections, heads)
}

#[tokio::test]
async fn warm_up_opens_one_keyless_connection_that_cleanup_reuses() {
    let (base, connections, heads) = serve().await;
    let engine = Engine::remote_at(Ok(Some(Secret::new(KEY))), &base);
    engine.warm_up().await;
    assert_eq!(*connections.lock().unwrap(), 1);
    let (reply, host) = engine.clean_with_host("um hello").await.unwrap();
    assert_eq!(
        (reply.as_str(), host.as_deref()),
        ("Hello.", Some("InferenceNet"))
    );
    assert_eq!(
        *connections.lock().unwrap(),
        1,
        "the call opened a new connection"
    );
    let heads = heads.lock().unwrap();
    assert_eq!(heads.len(), 2);
    assert!(heads[0].starts_with("head "), "{}", heads[0]);
    assert!(
        !heads[0].contains("authorization") && !heads[0].contains(KEY),
        "{}",
        heads[0]
    );
    assert!(heads[1].starts_with("post "), "{}", heads[1]);
}
