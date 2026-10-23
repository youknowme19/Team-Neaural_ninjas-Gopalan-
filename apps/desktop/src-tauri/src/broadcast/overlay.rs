use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, WebviewUrl};
use crate::commands::overlay::restore_overlay_preserving_pos;

pub const OVERLAY_LABEL: &str = "caption_overlay";

pub fn toggle_caption_overlay(app_handle: &AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let is_vis = window.is_visible().unwrap_or(false);
        let is_min = window.is_minimized().unwrap_or(false);
        if is_vis && !is_min {
            window.minimize().map_err(|e| e.to_string())?;
        } else {
            restore_overlay_preserving_pos(&window);
            let _ = window.set_focus();
        }
        return Ok(());
    }
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
    .title("LiveSpeak Spotlight")
    .inner_size(720.0, 240.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Position top-center of primary screen like macOS Spotlight
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let screen_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let logical_width = screen_size.width as f64 / scale_factor;

        let x = (logical_width - 720.0) / 2.0;
        let y = 100.0; // Top-centered like Spotlight
        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
    }

    Ok(window)
}
