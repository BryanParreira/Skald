use crate::{
    HealthCheckOptions, InstallCliResponse, ProviderAuthStatus, ProviderHealth,
    ProviderHealthStatus, ProviderKind, UninstallCliResponse,
};

pub fn health(options: &HealthCheckOptions) -> ProviderHealth {
    let health = skald_codex::health_check_with_options(&skald_codex::CodexOptions {
        codex_path_override: options.codex_path_override.clone(),
        ..Default::default()
    });

    ProviderHealth {
        provider: ProviderKind::Codex,
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
    let config_path = skald_codex::config_path();
    let command = skald_codex::notify_command();

    let mut table = skald_codex::read_config(&config_path)?;

    if table.contains_key("notify") && !skald_codex::has_notify(&table, &command) {
        return Err(format!(
            "refusing to replace existing notify handler in {}",
            config_path.display()
        ));
    }

    skald_codex::set_notify(&mut table, command);
    skald_codex::write_config(&config_path, &table)?;

    Ok(InstallCliResponse {
        provider: ProviderKind::Codex,
        target_path: config_path.clone(),
        message: format!(
            "Installed char as Codex notify handler in {}",
            config_path.display()
        ),
    })
}

pub fn upgrade() {
    upgrade_at(&skald_codex::config_path());
}

fn upgrade_at(config_path: &std::path::Path) {
    let command = skald_codex::notify_command();
    let Ok(mut table) = skald_codex::read_config(config_path) else {
        return;
    };
    if !skald_codex::has_notify(&table, &command) {
        return;
    }
    skald_codex::set_notify(&mut table, command);
    let _ = skald_codex::write_config(config_path, &table);
}

pub fn uninstall_cli() -> Result<UninstallCliResponse, String> {
    let config_path = skald_codex::config_path();
    let command = skald_codex::notify_command();
    let mut table = skald_codex::read_config(&config_path)?;

    if table.contains_key("notify") && !skald_codex::has_notify(&table, &command) {
        return Err(format!(
            "refusing to remove existing notify handler in {}",
            config_path.display()
        ));
    }

    skald_codex::remove_notify(&mut table);
    skald_codex::write_config(&config_path, &table)?;

    Ok(UninstallCliResponse {
        provider: ProviderKind::Codex,
        target_path: config_path.clone(),
        message: format!(
            "Removed char as Codex notify handler from {}",
            config_path.display()
        ),
    })
}

fn integration_installed() -> Result<bool, String> {
    let config_path = skald_codex::config_path();
    let table = skald_codex::read_config(&config_path)?;
    Ok(skald_codex::has_notify(
        &table,
        &skald_codex::notify_command(),
    ))
}

impl From<skald_codex::HealthStatus> for ProviderHealthStatus {
    fn from(value: skald_codex::HealthStatus) -> Self {
        match value {
            skald_codex::HealthStatus::Ready => Self::Ready,
            skald_codex::HealthStatus::Warning => Self::Warning,
            skald_codex::HealthStatus::Error => Self::Error,
        }
    }
}

impl From<skald_codex::HealthAuthStatus> for ProviderAuthStatus {
    fn from(value: skald_codex::HealthAuthStatus) -> Self {
        match value {
            skald_codex::HealthAuthStatus::Authenticated => Self::Authenticated,
            skald_codex::HealthAuthStatus::Unauthenticated => Self::Unauthenticated,
            skald_codex::HealthAuthStatus::Unknown => Self::Unknown,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upgrade_does_not_create_file_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");

        upgrade_at(&path);

        assert!(!path.exists());
    }

    #[test]
    fn upgrade_does_not_add_hook_when_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "").unwrap();

        upgrade_at(&path);

        let table = skald_codex::read_config(&path).unwrap();
        assert!(!skald_codex::has_notify(
            &table,
            &skald_codex::notify_command()
        ));
    }

    #[test]
    fn upgrade_refreshes_existing_hook() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.toml");

        let mut table = toml::Table::new();
        let command = skald_codex::notify_command();
        skald_codex::set_notify(&mut table, command.clone());
        skald_codex::write_config(&path, &table).unwrap();

        upgrade_at(&path);

        let table = skald_codex::read_config(&path).unwrap();
        assert!(skald_codex::has_notify(&table, &command));
    }
}
