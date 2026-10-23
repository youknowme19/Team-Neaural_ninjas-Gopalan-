use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WebviewUrl};

pub const OVERLAY_LABEL: &str = "caption_overlay";

pub fn toggle_caption_overlay(app_handle: &AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(OVERLAY_LABEL) {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
    } else {
        create_caption_overlay(app_handle)?;
    }
    Ok(())
}

pub fn create_caption_overlay(app_handle: &AppHandle) -> Result<WebviewWindow, String> {
    let window = WebviewWindowBuilder::new(
        app_handle,
        OVERLAY_LABEL,
        WebviewUrl::App("index.html?view=overlay".into()),
    )
    .title("LiveSpeak Overlay")
    .inner_size(820.0, 140.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Position at bottom center of primary screen
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let screen_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let logical_width = screen_size.width as f64 / scale_factor;
        let logical_height = screen_size.height as f64 / scale_factor;

        let x = (logical_width - 820.0) / 2.0;
        let y = logical_height - 180.0;
        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
    }

    Ok(window)
}
