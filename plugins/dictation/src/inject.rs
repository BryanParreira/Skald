use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::error::Error;

/// Pastes `text` into whichever app is currently focused, by round-tripping
/// through the system clipboard and synthesizing Cmd+V. The clipboard's
/// previous contents are restored afterward so this is invisible to the user.
pub async fn inject_text<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), Error> {
    if text.trim().is_empty() {
        return Ok(());
    }

    let clipboard = app.clipboard();
    let previous = clipboard.read_text().ok();

    clipboard
        .write_text(text.to_string())
        .map_err(|e| Error::Inject(e.to_string()))?;

    paste()?;

    // Give the target app a moment to read the pasteboard before we put the
    // previous contents back.
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    if let Some(previous) = previous {
        let _ = clipboard.write_text(previous);
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn paste() -> Result<(), Error> {
    hypr_text_inject_macos::paste().map_err(|e| Error::Inject(e.to_string()))
}

#[cfg(not(target_os = "macos"))]
fn paste() -> Result<(), Error> {
    Err(Error::Unsupported)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
        let mut ctx = tauri::test::mock_context(tauri::test::noop_assets());
        ctx.config_mut().identifier = "com.hyprnote.dev".to_string();
        ctx.config_mut().version = Some("1.0.0".to_string());

        tauri::test::mock_builder()
            .plugin(tauri_plugin_clipboard_manager::init())
            .build(ctx)
            .unwrap()
    }

    #[tokio::test]
    async fn empty_text_is_a_no_op() {
        let app = mock_app();
        // Must not touch the clipboard or attempt a paste keystroke for empty
        // input — otherwise every accidental empty dictation would clobber
        // whatever the user had copied.
        let result = inject_text(app.handle(), "").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn whitespace_only_text_is_a_no_op() {
        let app = mock_app();
        let result = inject_text(app.handle(), "   \n\t  ").await;
        assert!(result.is_ok());
    }
}
