use crate::{
    HealthCheckOptions, InstallCliResponse, ProviderAuthStatus, ProviderHealth,
    ProviderHealthStatus, ProviderKind, UninstallCliResponse,
};

pub fn health(options: &HealthCheckOptions) -> ProviderHealth {
    let health = skald_opencode::health_check_with_options(&skald_opencode::OpencodeOptions {
        opencode_path_override: options.opencode_path_override.clone(),
        ..Default::default()
    });

    ProviderHealth {
        provider: ProviderKind::Opencode,
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
    let plugin_path = skald_opencode::plugin_path();

    if plugin_path.exists() && !skald_opencode::is_char_plugin(&plugin_path)? {
        return Err(format!(
            "refusing to replace existing plugin at {}",
            plugin_path.display()
        ));
    }

    skald_opencode::write_plugin(&plugin_path)?;

    Ok(InstallCliResponse {
        provider: ProviderKind::Opencode,
        target_path: plugin_path.clone(),
        message: format!(
            "Installed char as OpenCode plugin at {}",
            plugin_path.display()
        ),
    })
}

pub fn uninstall_cli() -> Result<UninstallCliResponse, String> {
    let plugin_path = skald_opencode::plugin_path();

    if plugin_path.exists() && !skald_opencode::has_char_plugin(&plugin_path)? {
        return Err(format!(
            "refusing to remove existing plugin at {}",
            plugin_path.display()
        ));
    }

    skald_opencode::remove_plugin(&plugin_path)?;

    Ok(UninstallCliResponse {
        provider: ProviderKind::Opencode,
        target_path: plugin_path.clone(),
        message: format!(
            "Removed char as OpenCode plugin from {}",
            plugin_path.display()
        ),
    })
}

pub fn upgrade() {
    upgrade_at(&skald_opencode::plugin_path());
}

fn upgrade_at(plugin_path: &std::path::Path) {
    if skald_opencode::is_char_plugin(plugin_path).unwrap_or(false) {
        let _ = skald_opencode::write_plugin(plugin_path);
    }
}

fn integration_installed() -> Result<bool, String> {
    let plugin_path = skald_opencode::plugin_path();
    skald_opencode::is_char_plugin(&plugin_path)
}

impl From<skald_opencode::HealthStatus> for ProviderHealthStatus {
    fn from(value: skald_opencode::HealthStatus) -> Self {
        match value {
            skald_opencode::HealthStatus::Ready => Self::Ready,
            skald_opencode::HealthStatus::Warning => Self::Warning,
            skald_opencode::HealthStatus::Error => Self::Error,
        }
    }
}

impl From<skald_opencode::HealthAuthStatus> for ProviderAuthStatus {
    fn from(value: skald_opencode::HealthAuthStatus) -> Self {
        match value {
            skald_opencode::HealthAuthStatus::Authenticated => Self::Authenticated,
            skald_opencode::HealthAuthStatus::Unauthenticated => Self::Unauthenticated,
            skald_opencode::HealthAuthStatus::Unknown => Self::Unknown,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upgrade_does_not_create_file_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("char.ts");

        upgrade_at(&path);

        assert!(!path.exists());
    }

    #[test]
    fn upgrade_does_not_add_hook_when_not_installed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("char.ts");
        std::fs::write(&path, "export const plugin = {};\n").unwrap();

        upgrade_at(&path);

        let contents = std::fs::read_to_string(&path).unwrap();
        assert_eq!(contents, "export const plugin = {};\n");
    }

    #[test]
    fn upgrade_refreshes_existing_plugin() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("char.ts");

        let old_plugin = r#"const child = Bun.spawn(["char", "opencode", "notify"]);"#;
        std::fs::write(&path, old_plugin).unwrap();

        upgrade_at(&path);

        assert!(skald_opencode::has_char_plugin(&path).unwrap());
    }
}
