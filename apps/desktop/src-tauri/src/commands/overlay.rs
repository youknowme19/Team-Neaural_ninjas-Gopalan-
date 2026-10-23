use tauri::AppHandle;
use crate::broadcast::overlay::toggle_caption_overlay;

#[tauri::command]
pub fn toggle_overlay(app_handle: AppHandle) -> Result<(), String> {
    toggle_caption_overlay(&app_handle)
}
