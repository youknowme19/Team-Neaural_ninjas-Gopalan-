use std::sync::Mutex;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow};
use crate::broadcast::overlay::toggle_caption_overlay;

static SAVED_COLLAPSED_POS: Mutex<Option<(i32, i32)>> = Mutex::new(None);
static CURRENT_PILL_WIDTH: Mutex<f64> = Mutex::new(560.0);

fn get_pill_width() -> f64 {
    CURRENT_PILL_WIDTH.lock().map(|w| *w).unwrap_or(560.0)
}

/// Initial placement on startup (or recovery if completely off-screen)
pub fn snap_overlay_to_bottom(win: &WebviewWindow, expanded: bool) {
    let width = get_pill_width();
    let height = if expanded { 330.0 } else { 84.0 };
    let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));

    let monitor_opt = win
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| win.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor_opt {
        let screen = monitor.size();
        let scale = monitor.scale_factor();
        let logical_w = screen.width as f64 / scale;
        let logical_h = screen.height as f64 / scale;

        let x = ((logical_w - width) / 2.0).max(20.0);
        let y = (logical_h - 160.0).max(60.0);
        let _ = win.set_position(Position::Logical(LogicalPosition::new(x, y)));
    }

    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_always_on_top(true);
}

/// Ensures the window is visible without overriding the user's custom dragged position
pub fn restore_overlay_preserving_pos(win: &WebviewWindow) {
    let _ = win.show();
    let _ = win.unminimize();
    let _ = win.set_always_on_top(true);

    if let (Ok(pos), Ok(Some(mon))) = (win.outer_position(), win.primary_monitor()) {
        let sw = mon.size().width as i32;
        let sh = mon.size().height as i32;
        if pos.x < -400 || pos.x > sw - 80 || pos.y < -40 || pos.y > sh - 40 {
            snap_overlay_to_bottom(win, false);
        }
    }
}

#[tauri::command]
pub fn start_window_drag(app_handle: AppHandle) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window("main") {
        let _ = win.start_dragging();
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_overlay(app_handle: AppHandle) -> Result<(), String> {
    toggle_caption_overlay(&app_handle)
}

#[tauri::command]
pub fn set_overlay_width(app_handle: AppHandle, width: f64, expanded: bool) -> Result<f64, String> {
    let clamped_w = width.clamp(460.0, 1080.0);
    if let Ok(mut w) = CURRENT_PILL_WIDTH.lock() {
        *w = clamped_w;
    }
    if let Some(win) = app_handle.get_webview_window("main") {
        let height = if expanded { 330.0 } else { 84.0 };
        let _ = win.set_size(Size::Logical(LogicalSize::new(clamped_w, height)));
    }
    Ok(clamped_w)
}

#[tauri::command]
pub fn set_overlay_expanded(app_handle: AppHandle, expanded: bool) -> Result<(), String> {
    if let Some(win) = app_handle.get_webview_window("main") {
        let width = get_pill_width();
        let height = if expanded { 330.0 } else { 84.0 };
        let scale = win.scale_factor().unwrap_or(1.0);

        if expanded {
            if let Ok(pos) = win.outer_position() {
                if let Ok(mut saved) = SAVED_COLLAPSED_POS.lock() {
                    *saved = Some((pos.x, pos.y));
                }
                if let Ok(Some(mon)) = win.current_monitor().or_else(|_| win.primary_monitor()) {
                    let sh = mon.size().height as i32;
                    let req_phys_h = (330.0 * scale) as i32;
                    if pos.y + req_phys_h > sh - 48 {
                        let new_y = (sh - req_phys_h - 48).max(20);
                        let _ = win.set_position(Position::Physical(PhysicalPosition::new(pos.x, new_y)));
                    }
                }
            }
            let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));
        } else {
            let _ = win.set_size(Size::Logical(LogicalSize::new(width, height)));
            if let Ok(mut saved) = SAVED_COLLAPSED_POS.lock() {
                if let Some((sx, sy)) = saved.take() {
                    let _ = win.set_position(Position::Physical(PhysicalPosition::new(sx, sy)));
                }
            }
        }

        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_always_on_top(true);
    }
    Ok(())
}
