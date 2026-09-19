use skald_calendar_interface::{
    CalendarEvent, CalendarListItem, CalendarProviderType, CreateEventInput, EventFilter,
};
use tauri::Manager;
use tauri_plugin_auth::AuthPluginExt;
use tauri_plugin_permissions::PermissionsPluginExt;

use crate::error::Error;

#[tauri::command]
#[specta::specta]
pub fn available_providers() -> Vec<CalendarProviderType> {
    skald_calendar::available_providers()
}

#[tauri::command]
#[specta::specta]
pub async fn is_provider_enabled<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    provider: CalendarProviderType,
) -> Result<bool, Error> {
    let config = app.state::<crate::PluginConfig>();
    let token = access_token(&app);
    let apple = is_apple_authorized(&app).await?;
    skald_calendar::is_provider_enabled(&config.api_base_url, token.as_deref(), apple, provider)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn list_connection_ids<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Vec<skald_calendar::ProviderConnectionIds>, Error> {
    let config = app.state::<crate::PluginConfig>();
    let token = access_token(&app);
    let apple = is_apple_authorized(&app).await?;
    skald_calendar::list_connection_ids(&config.api_base_url, token.as_deref(), apple)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn list_calendars<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    provider: CalendarProviderType,
    connection_id: String,
) -> Result<Vec<CalendarListItem>, Error> {
    let config = app.state::<crate::PluginConfig>();
    let token = match provider {
        CalendarProviderType::Apple => access_token(&app).unwrap_or_default(),
        _ => require_access_token(&app)?,
    };
    skald_calendar::list_calendars(&config.api_base_url, &token, provider, &connection_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub async fn list_events<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    provider: CalendarProviderType,
    connection_id: String,
    filter: EventFilter,
) -> Result<Vec<CalendarEvent>, Error> {
    let config = app.state::<crate::PluginConfig>();
    let token = match provider {
        CalendarProviderType::Apple => access_token(&app).unwrap_or_default(),
        _ => require_access_token(&app)?,
    };
    skald_calendar::list_events(
        &config.api_base_url,
        &token,
        provider,
        &connection_id,
        filter,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub fn open_calendar<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    provider: CalendarProviderType,
) -> Result<(), Error> {
    skald_calendar::open_calendar(provider).map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub fn create_event<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    provider: CalendarProviderType,
    input: CreateEventInput,
) -> Result<String, Error> {
    skald_calendar::create_event(provider, input).map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub fn parse_meeting_link(text: String) -> Option<String> {
    skald_calendar::parse_meeting_link(&text)
}

fn access_token<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<String> {
    app.access_token().ok().flatten().filter(|t| !t.is_empty())
}

fn require_access_token<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<String, Error> {
    let token = app.access_token().map_err(|e| Error::Auth(e.to_string()))?;
    match token {
        Some(t) if !t.is_empty() => Ok(t),
        _ => Err(skald_calendar::Error::NotAuthenticated.into()),
    }
}

async fn is_apple_authorized<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<bool, Error> {
    #[cfg(target_os = "macos")]
    {
        let status = app
            .permissions()
            .check(tauri_plugin_permissions::Permission::Calendar)
            .await
            .map_err(|e| skald_calendar::Error::Api(e.to_string()))?;
        Ok(matches!(
            status,
            tauri_plugin_permissions::PermissionStatus::Authorized
        ))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(false)
    }
}
