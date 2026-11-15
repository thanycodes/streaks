//! Streaks in the macOS menu bar: a tray icon that opens the web app in a popover window.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_positioner::{Position, WindowExt};

/// When the popover last hid because it lost focus.
#[derive(Default)]
struct LastBlur(Mutex<Option<Instant>>);

/// Clicking the tray icon while the popover is open first blurs (hiding it), then delivers the
/// click. Without this grace period that click would immediately reopen it.
const REOPEN_GRACE: Duration = Duration::from_millis(250);

fn toggle_popover(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    let just_blurred = app
        .state::<LastBlur>()
        .0
        .lock()
        .ok()
        .and_then(|last| *last)
        .is_some_and(|at| at.elapsed() < REOPEN_GRACE);
    if just_blurred {
        return;
    }
    // The tray's position is only known once the pointer has been over it; until then
    // (e.g. the very first ⌃⌥S) open in the top-right corner, where the menu bar icons are.
    if window.move_window_constrained(Position::TrayBottomCenter).is_err() {
        let _ = window.move_window(Position::TopRight);
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn hide_popover(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    let result = if enabled { launcher.enable() } else { launcher.disable() };
    result.map_err(|e| e.to_string())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Streaks", true, Some("Ctrl+Alt+S"))?;
    let quit = MenuItem::with_id(app, "quit", "Quit Streaks", true, Some("Cmd+Q"))?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;

    TrayIconBuilder::with_id("streaks")
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        // Template icons are drawn by macOS in the menu bar's own colour (light or dark).
        .icon_as_template(true)
        .tooltip("Streaks")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => toggle_popover(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_popover(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyS);

    tauri::Builder::default()
        .manage(LastBlur::default())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(shortcut)
                .expect("⌃⌥S is a valid shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_popover(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![hide_popover, autostart_enabled, set_autostart])
        .setup(|app| {
            // Menu bar app: no Dock icon, no app menu.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            build_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Focused(false) = event {
                if let Ok(mut last) = window.state::<LastBlur>().0.lock() {
                    *last = Some(Instant::now());
                }
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Streaks");
}
