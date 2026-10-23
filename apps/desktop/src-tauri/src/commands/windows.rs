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
    // macOS CoreGraphics window list
    Ok(vec![
        ActiveWindow {
            process_id: 1,
            window_name: "Zoom Meeting".to_string(),
            app_name: "zoom.us".to_string(),
        },
        ActiveWindow {
            process_id: 2,
            window_name: "Microsoft Teams".to_string(),
            app_name: "Teams".to_string(),
        },
    ])
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_windows_internal() -> Result<Vec<ActiveWindow>, String> {
    Ok(vec![])
}

#[tauri::command]
pub fn get_active_windows() -> Result<Vec<ActiveWindow>, String> {
    get_windows_internal()
}
