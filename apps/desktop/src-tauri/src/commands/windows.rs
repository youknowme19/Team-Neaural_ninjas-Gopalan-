use crate::state::ActiveWindow;

fn friendly_app_name(raw_exe: &str, title: &str) -> String {
    let lower = raw_exe.to_lowercase();
    let stem = lower.trim_end_matches(".exe");
    match stem {
        "chrome" => "Google Chrome".to_string(),
        "msedge" => "Microsoft Edge".to_string(),
        "brave" => "Brave Browser".to_string(),
        "firefox" => "Mozilla Firefox".to_string(),
        "vlc" => "VLC Media Player".to_string(),
        "spotify" => "Spotify".to_string(),
        "zoom" => "Zoom Meeting".to_string(),
        "ms-teams" | "teams" => "Microsoft Teams".to_string(),
        "discord" => "Discord".to_string(),
        "applicationframehost" | "video.ui" | "microsoft.media.player" => "Media Player".to_string(),
        "code" => "VS Code".to_string(),
        "explorer" => "File Explorer".to_string(),
        other if !other.is_empty() => {
            let mut chars = other.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => "App".to_string(),
            }
        }
        _ => {
            if let Some(last_part) = title.split(" - ").last() {
                last_part.trim().to_string()
            } else {
                "Application".to_string()
            }
        }
    }
}

fn check_is_media_likely(app_name: &str, title: &str) -> bool {
    let combined = format!("{} {}", app_name.to_lowercase(), title.to_lowercase());
    let keywords = [
        "youtube", "video", "vlc", "media", "netflix", "prime", "hotstar", "jio", "cricket",
        "match", "live", "stream", "twitch", "spotify", "music", "zoom", "meet", "teams",
        "discord", "chrome", "edge", "brave", "firefox", "player", "movie", "lecture",
    ];
    keywords.iter().any(|k| combined.contains(k))
}

#[cfg(target_os = "windows")]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
    use windows::Win32::System::ProcessStatus::K32GetModuleBaseNameW;
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_VM_READ};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct EnumData {
        windows: Vec<ActiveWindow>,
        self_pid: u32,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &mut *(lparam.0 as *mut EnumData);

        if IsWindowVisible(hwnd).as_bool() {
            let mut text_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut text_buf);
            if len > 0 {
                let title = OsString::from_wide(&text_buf[..len as usize])
                    .to_string_lossy()
                    .into_owned();
                let trimmed_title = title.trim();

                let mut pid: u32 = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));

                // Skip our own overlay and hidden OS shell helpers
                let skip_titles = [
                    "LiveSpeak Spotlight",
                    "Program Manager",
                    "Default IME",
                    "MSCTFIME UI",
                    "Windows Input Experience",
                    "Microsoft Text Input Application",
                    "Settings",
                ];

                if !trimmed_title.is_empty()
                    && pid > 0
                    && pid != data.self_pid
                    && !skip_titles.iter().any(|&s| trimmed_title.eq_ignore_ascii_case(s))
                {
                    let mut exe_name = String::new();
                    if let Ok(hproc) = OpenProcess(
                        PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ,
                        false,
                        pid,
                    ) {
                        let mut mod_buf = [0u16; 260];
                        let mlen = K32GetModuleBaseNameW(hproc, None, &mut mod_buf);
                        if mlen > 0 {
                            exe_name = OsString::from_wide(&mod_buf[..mlen as usize])
                                .to_string_lossy()
                                .into_owned();
                        }
                        let _ = CloseHandle(hproc);
                    }

                    let app_name = friendly_app_name(&exe_name, trimmed_title);
                    let is_media_likely = check_is_media_likely(&app_name, trimmed_title);

                    // Deduplicate identical titles
                    if !data
                        .windows
                        .iter()
                        .any(|w| w.window_name == trimmed_title && w.process_id == pid)
                    {
                        data.windows.push(ActiveWindow {
                            process_id: pid,
                            window_name: trimmed_title.to_string(),
                            app_name,
                            is_media_likely,
                        });
                    }
                }
            }
        }
        BOOL(1)
    }

    let mut data = EnumData {
        windows: Vec::new(),
        self_pid: std::process::id(),
    };
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut data as *mut _ as isize));
    }

    // Sort media/video/browser windows first so the user can pick their video app in 1 click
    data.windows.sort_by(|a, b| b.is_media_likely.cmp(&a.is_media_likely));

    Ok(data.windows)
}

#[cfg(target_os = "macos")]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    use std::path::PathBuf;
    use std::process::Command;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct RawWindow {
        process_id: u32,
        window_name: String,
        app_name: String,
    }

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| cwd.clone());

    let candidates = [
        exe_dir.join("screencapture-bridge"),
        exe_dir.join("screencapture-bridge-aarch64-apple-darwin"),
        cwd.join("bin/screencapture-bridge"),
        cwd.join("src-tauri/bin/screencapture-bridge"),
        PathBuf::from("/Volumes/SSD/Gopalan/apps/desktop/src-tauri/bin/screencapture-bridge"),
        PathBuf::from("/Volumes/SSD/Gopalan/LiveSpeak.app/Contents/MacOS/screencapture-bridge"),
    ];

    let bridge_path = candidates.iter().find(|p| p.exists()).cloned();
    if let Some(path) = bridge_path {
        if let Ok(output) = Command::new(&path).arg("list-windows").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(raw_list) = serde_json::from_str::<Vec<RawWindow>>(&stdout) {
                    let self_pid = std::process::id();
                    let mut windows: Vec<ActiveWindow> = Vec::new();

                    for w in raw_list {
                        if w.process_id == self_pid {
                            continue;
                        }
                        let name_low = w.app_name.to_lowercase();
                        if name_low == "dock" || name_low == "notification centre" || name_low == "control centre" {
                            continue;
                        }

                        let app_name = friendly_app_name(&w.app_name, &w.window_name);
                        let is_media_likely = check_is_media_likely(&app_name, &w.window_name);

                        if !windows.iter().any(|existing| existing.process_id == w.process_id && existing.window_name == w.window_name) {
                            windows.push(ActiveWindow {
                                process_id: w.process_id,
                                window_name: w.window_name,
                                app_name,
                                is_media_likely,
                            });
                        }
                    }

                    windows.sort_by(|a, b| b.is_media_likely.cmp(&a.is_media_likely));
                    return Ok(windows);
                }
            }
        }
    }

    Ok(vec![])
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    Ok(vec![])
}

#[tauri::command]
pub fn get_active_windows() -> Result<Vec<ActiveWindow>, String> {
    get_windows_internal()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_macos_window_discovery() {
        let windows = get_windows_internal().expect("Failed to get windows");
        println!("Discovered {} windows on macOS", windows.len());
        for w in &windows {
            println!("  [PID {}] {}: {} (media: {})", w.process_id, w.app_name, w.window_name, w.is_media_likely);
        }
        assert!(!windows.is_empty(), "Should discover at least one window on macOS");
    }
}
