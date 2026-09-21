use tauri::Manager;

mod commands;
mod error;
mod ext;
mod store;

pub use error::{Error, Result};
pub use ext::*;
use store::*;

pub use notiz_analytics::*;

pub type ManagedState = notiz_analytics::AnalyticsClient;

const PLUGIN_NAME: &str = "analytics";

fn make_specta_builder<R: tauri::Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::<R>::new()
        .plugin_name(PLUGIN_NAME)
        .commands(tauri_specta::collect_commands![
            commands::event::<tauri::Wry>,
            commands::set_properties::<tauri::Wry>,
            commands::set_disabled::<tauri::Wry>,
            commands::is_disabled::<tauri::Wry>,
            commands::identify::<tauri::Wry>,
        ])
        .error_handling(tauri_specta::ErrorHandlingMode::Result)
}

pub fn init<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let specta_builder = make_specta_builder();

    tauri::plugin::Builder::new(PLUGIN_NAME)
        .invoke_handler(specta_builder.invoke_handler())
        .setup(|app, _api| {
            // Notiz collects no usage analytics. The client is built with no
            // PostHog key, which leaves its `posthog` field `None` and makes
            // every event a no-op, so nothing leaves the device no matter
            // what any caller does. The plugin itself stays because
            // `plugins/flag` reuses `notiz_analytics::AnalyticsClient` as the
            // type of its managed state for feature flags.
            let client = notiz_analytics::AnalyticsClientBuilder::default().build();

            assert!(app.manage(client));
            Ok(())
        })
        .build()
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

    fn create_app<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::App<R> {
        let mut ctx = tauri::test::mock_context(tauri::test::noop_assets());
        ctx.config_mut().identifier = "com.notiz.dev".to_string();
        ctx.config_mut().version = Some("0.0.1".to_string());

        builder.plugin(init()).build(ctx).unwrap()
    }

    #[tokio::test]
    async fn test_analytics() {
        let app = create_app(tauri::test::mock_builder());
        let result = app
            .analytics()
            .event(notiz_analytics::AnalyticsPayload::builder("test_event").build())
            .await;
        assert!(result.is_ok());

        {
            use tauri_plugin_misc::MiscPluginExt;
            let git_hash = app.misc().get_git_hash();
            println!("git_hash: {}", git_hash);
        }

        {
            let version = app.config().version.clone();
            println!("version: {}", version.unwrap_or_default());
        }

        {
            let bundle_id = app.config().identifier.clone();
            println!("bundle_id: {}", bundle_id);
        }
    }
}
