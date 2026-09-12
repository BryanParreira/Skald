use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

pub struct TrayQuit;

impl MenuItemHandler for TrayQuit {
    const ID: &'static str = "hypr_tray_quit";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(app, Self::ID, "Quit", true, Some("cmd+q"))?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        #[cfg(target_os = "macos")]
        {
            hypr_host::kill_processes_by_matcher(hypr_host::ProcessMatcher::Sidecar);
        }

        // Deliberately does NOT call hypr_intercept::set_force_quit() — that
        // flag makes the RunEvent::ExitRequested handler in lib.rs skip
        // closing windows entirely, which is what runs the flush-before-quit
        // save logic in each window's JS. app.exit() already triggers the
        // normal, preventable ExitRequested/Exit sequence on its own; this
        // quit path needs no special-casing to skip it.
        app.exit(0);
    }
}
