mod cleanup;
mod commands;
mod error;
mod events;
mod ext;
mod handler;
mod inject;
mod stt;

pub use error::*;
pub use events::*;
pub use ext::*;

use handler::Handler;
use tauri::Manager;

struct DictationSession(tokio::sync::Mutex<Option<stt::ActiveSession>>);

const PLUGIN_NAME: &str = "dictation";

fn make_specta_builder<R: tauri::Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::<R>::new()
        .plugin_name(PLUGIN_NAME)
        .commands(tauri_specta::collect_commands![
            commands::show::<tauri::Wry>,
            commands::hide::<tauri::Wry>,
            commands::set_phase::<tauri::Wry>,
            commands::update_amplitude::<tauri::Wry>,
        ])
        .error_handling(tauri_specta::ErrorHandlingMode::Result)
}

pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    let specta_builder = make_specta_builder();

    tauri::plugin::Builder::new(PLUGIN_NAME)
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app, _api| {
            app.manage(Handler::new());
            app.manage(DictationSession(tokio::sync::Mutex::new(None)));
            setup_shortcut_bridge(app);
            Ok(())
        })
        .build()
}

fn setup_shortcut_bridge(app: &tauri::AppHandle) {
    use ext::DictationPluginExt;
    use tauri_plugin_shortcut::ShortcutEvent;
    use tauri_specta::Event;

    let handle = app.clone();
    ShortcutEvent::listen(app, move |event| {
        let d = handle.dictation();
        match event.payload {
            ShortcutEvent::Pressed => {
                let _ = d.set_phase(Phase::Recording);
                let _ = d.show();
                start_dictation(handle.clone());
            }
            ShortcutEvent::Released => {
                let _ = d.set_phase(Phase::Processing);
                let _ = d.hide();
                stop_dictation_and_inject(handle.clone());
            }
            ShortcutEvent::Cancelled | ShortcutEvent::Discarded => {
                let _ = d.hide();
                discard_dictation(handle.clone());
            }
        }
    });
}

fn start_dictation(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let session = app.state::<DictationSession>();
        let mut slot = session.0.lock().await;

        if slot.is_some() {
            return;
        }

        match stt::ActiveSession::start(app.clone()).await {
            Ok(active) => *slot = Some(active),
            Err(e) => {
                tracing::warn!(error = %e, "dictation_start_failed");
                // The overlay is shown before the model starts; leaving it up
                // would look like dictation is listening when nothing will type.
                use ext::DictationPluginExt;
                let _ = app.dictation().hide();
            }
        }
    });
}

fn stop_dictation_and_inject(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let active = {
            let session = app.state::<DictationSession>();
            let mut slot = session.0.lock().await;
            slot.take()
        };

        let Some(active) = active else {
            return;
        };

        match active.stop().await {
            Ok(text) => {
                let text = cleanup::polish(&app, &text).await;
                if let Err(e) = inject::inject_text(&app, &text).await {
                    tracing::warn!(error = %e, "dictation_inject_failed");
                }
            }
            Err(e) => tracing::warn!(error = %e, "dictation_transcribe_failed"),
        }
    });
}

fn discard_dictation(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let active = {
            let session = app.state::<DictationSession>();
            let mut slot = session.0.lock().await;
            slot.take()
        };

        if let Some(active) = active {
            let _ = active.stop().await;
        }
    });
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn export_types() {
        const OUTPUT_FILE: &str = "./js/bindings.gen.ts";

        make_specta_builder::<tauri::Wry>()
            .export(
                specta_typescript::Typescript::default()
                    .formatter(specta_typescript::formatter::prettier)
                    .bigint(specta_typescript::BigIntExportBehavior::Number),
                OUTPUT_FILE,
            )
            .unwrap();

        let content = std::fs::read_to_string(OUTPUT_FILE).unwrap();
        std::fs::write(OUTPUT_FILE, format!("// @ts-nocheck\n{content}")).unwrap();
    }
}
