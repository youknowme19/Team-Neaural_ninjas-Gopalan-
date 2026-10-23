use crate::state::ActiveWindow;

#[cfg(target_os = "windows")]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct EnumData {
        windows: Vec<ActiveWindow>,
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

                let mut pid: u32 = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));

                if !title.trim().is_empty() && pid > 0 {
                    data.windows.push(ActiveWindow {
                        process_id: pid,
                        window_name: title.clone(),
                        app_name: format!("PID: {}", pid),
                    });
                }
            }
        }
        BOOL(1)
    }

    let mut data = EnumData { windows: Vec::new() };
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut data as *mut _ as isize));
    }

    Ok(data.windows)
}

#[cfg(target_os = "macos")]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    use std::process::Command;

    let output = Command::new("ps")
        .args(["-eo", "pid,command"])
        .output()
        .map_err(|e| format!("Failed to execute ps command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut windows = Vec::new();

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.contains("Helper") || trimmed.contains("grep") {
            continue;
        }

        if trimmed.contains("/Applications/") || trimmed.contains("/System/Applications/") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }

            if let Ok(pid) = parts[0].parse::<u32>() {
                let full_cmd = parts[1..].join(" ");
                // Extract clean application name
                let app_name = if let Some(app_pos) = full_cmd.find(".app") {
                    let before_app = &full_cmd[..app_pos];
                    if let Some(slash_pos) = before_app.rfind('/') {
                        before_app[slash_pos + 1..].to_string()
                    } else {
                        "Application".to_string()
                    }
                } else {
                    "Application".to_string()
                };

                windows.push(ActiveWindow {
                    process_id: pid,
                    window_name: format!("{} (PID: {})", app_name, pid),
                    app_name,
                });
            }
        }
    }

    if windows.is_empty() {
        windows.push(ActiveWindow {
            process_id: std::process::id(),
            window_name: "LiveSpeak Desktop".to_string(),
            app_name: "LiveSpeak".to_string(),
        });
    }

    Ok(windows)
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    Ok(vec![])
}

#[tauri::command]
pub fn get_active_windows() -> Result<Vec<ActiveWindow>, String> {
    get_windows_internal()
}
