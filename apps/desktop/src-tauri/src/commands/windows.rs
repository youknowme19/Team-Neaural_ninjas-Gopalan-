use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveWindow {
    pub window_name: String,
    pub process_id: i32,
    pub app_name: String,
}

#[tauri::command]
pub fn get_active_windows() -> Result<Vec<ActiveWindow>, String> {
    let binary_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("screencapture-bridge")))
        .filter(|p| p.exists())
        .unwrap_or_else(|| std::path::PathBuf::from("./bin/screencapture-bridge"));

    let output = Command::new(&binary_path)
        .arg("list-windows")
        .output()
        .map_err(|e| format!("Failed to execute screencapture-bridge ({}): {}", binary_path.display(), e))?;

    if !output.status.success() {
        return Err(format!("screencapture-bridge exited with status: {}", output.status));
    }

    let json_str = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 from screencapture-bridge: {}", e))?;

    let windows: Vec<ActiveWindow> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse window list JSON: {}", e))?;

    Ok(windows)
}
