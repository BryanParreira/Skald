use crate::{
    HealthCheckOptions, InstallCliResponse, ProviderAuthStatus, ProviderHealth,
    ProviderHealthStatus, ProviderKind, UninstallCliResponse,
};

const STOP_EVENT: &str = "Stop";
const COMMAND: &str = "char claude notify";

pub fn health(options: &HealthCheckOptions) -> ProviderHealth {
    let health = notiz_claude::health_check_with_options(&notiz_claude::ClaudeOptions {
        claude_path_override: options.claude_path_override.clone(),
        ..Default::default()
    });

    ProviderHealth {
        provider: ProviderKind::Claude,
        binary_path: health.binary_path,
        installed: health.installed,
        integration_installed: integration_installed().unwrap_or(false),
        version: health.version,
        status: health.status.into(),
        auth_status: health.auth_status.into(),
        message: health.message,
    }
}

pub fn install_cli() -> Result<InstallCliResponse, String> {
    let settings_path = notiz_claude::settings_path();
    let mut settings = notiz_claude::read_settings(&settings_path)?;

    notiz_claude::upsert_command_hook(&mut settings, STOP_EVENT, COMMAND)?;
    notiz_claude::write_settings(&settings_path, &settings)?;

    Ok(InstallCliResponse {
        provider: ProviderKind::Claude,
        target_path: settings_path.clone(),
        message: format!(
            "Installed char as Claude Code hook handler in {}",
            settings_path.display()
        ),
    })
}

pub fn upgrade() {
    upgrade_at(&notiz_claude::settings_path());
}

fn upgrade_at(settings_path: &std::path::Path) {
    let Ok(mut settings) = notiz_claude::read_settings(settings_path) else {
        return;
    };
    if !notiz_claude::has_command_hook(&settings, STOP_EVENT, COMMAND) {
        return;
    }
    let _ = notiz_claude::remove_command_hook(&mut settings, STOP_EVENT, COMMAND);
    let _ = notiz_claude::upsert_command_hook(&mut settings, STOP_EVENT, COMMAND);
    let _ = notiz_claude::write_settings(settings_path, &settings);
}

pub fn uninstall_cli() -> Result<UninstallCliResponse, String> {
    let settings_path = notiz_claude::settings_path();
    let mut settings = notiz_claude::read_settings(&settings_path)?;

    notiz_claude::remove_command_hook(&mut settings, STOP_EVENT, COMMAND)?;
    notiz_claude::write_settings(&settings_path, &settings)?;

    Ok(UninstallCliResponse {
        provider: ProviderKind::Claude,
        target_path: settings_path.clone(),
        message: format!(
            "Removed char as Claude Code hook handler from {}",
            settings_path.display()
        ),
    })
}

fn integration_installed() -> Result<bool, String> {
    let settings_path = notiz_claude::settings_path();
    let settings = notiz_claude::read_settings(&settings_path)?;
    Ok(notiz_claude::has_command_hook(
        &settings, STOP_EVENT, COMMAND,
    ))
}

impl From<notiz_claude::HealthStatus> for ProviderHealthStatus {
    fn from(value: notiz_claude::HealthStatus) -> Self {
        match value {
            notiz_claude::HealthStatus::Ready => Self::Ready,
            notiz_claude::HealthStatus::Warning => Self::Warning,
            notiz_claude::HealthStatus::Error => Self::Error,
        }
    }
}

impl From<notiz_claude::HealthAuthStatus> for ProviderAuthStatus {
    fn from(value: notiz_claude::HealthAuthStatus) -> Self {
        match value {
            notiz_claude::HealthAuthStatus::Authenticated => Self::Authenticated,
            notiz_claude::HealthAuthStatus::Unauthenticated => Self::Unauthenticated,
            notiz_claude::HealthAuthStatus::Unknown => Self::Unknown,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upgrade_does_not_create_file_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        upgrade_at(&path);

        assert!(!path.exists());
    }

    #[test]
    fn upgrade_does_not_add_hook_when_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{}").unwrap();

        upgrade_at(&path);

        let settings = notiz_claude::read_settings(&path).unwrap();
        assert!(!notiz_claude::has_command_hook(
            &settings, STOP_EVENT, COMMAND
        ));
    }

    #[test]
    fn upgrade_refreshes_existing_hook() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        let mut settings = serde_json::json!({});
        notiz_claude::upsert_command_hook(&mut settings, STOP_EVENT, COMMAND).unwrap();
        notiz_claude::write_settings(&path, &settings).unwrap();

        upgrade_at(&path);

        let settings = notiz_claude::read_settings(&path).unwrap();
        assert!(notiz_claude::has_command_hook(
            &settings, STOP_EVENT, COMMAND
        ));
    }
}
