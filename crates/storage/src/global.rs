use std::path::{Path, PathBuf};

pub const VAULT_CONFIG_FILENAME: &str = "global.json";
const STAGING_BUNDLE_ID: &str = "com.skald.staging";
const RELEASE_APP_FOLDER: &str = "com.skald.app";
const LEGACY_RELEASE_APP_FOLDER_V1: &str = "skald";
const LEGACY_RELEASE_APP_FOLDER_V0: &str = "skald";

pub fn compute_vault_config_path(base: &Path) -> PathBuf {
    base.join(VAULT_CONFIG_FILENAME)
}

pub fn compute_default_base(bundle_id: &str) -> Option<PathBuf> {
    let data_dir = dirs::data_dir()?;
    let app_folder = resolve_app_folder(&data_dir, bundle_id, cfg!(debug_assertions));
    Some(data_dir.join(app_folder))
}

fn resolve_app_folder<'a>(data_dir: &Path, bundle_id: &str, is_debug: bool) -> String {
    if is_debug || bundle_id == STAGING_BUNDLE_ID {
        return bundle_id.to_string();
    }

    // Migrate legacy data folders in priority order
    if has_app_data(&data_dir.join(LEGACY_RELEASE_APP_FOLDER_V1))
        && !has_app_data(&data_dir.join(RELEASE_APP_FOLDER))
    {
        return LEGACY_RELEASE_APP_FOLDER_V1.to_string();
    }

    if has_app_data(&data_dir.join(LEGACY_RELEASE_APP_FOLDER_V0))
        && !has_app_data(&data_dir.join(RELEASE_APP_FOLDER))
        && !has_app_data(&data_dir.join(LEGACY_RELEASE_APP_FOLDER_V1))
    {
        return LEGACY_RELEASE_APP_FOLDER_V0.to_string();
    }

    RELEASE_APP_FOLDER.to_string()
}

fn has_app_data(path: &Path) -> bool {
    std::fs::read_dir(path)
        .map(|mut entries| entries.next().is_some())
        .unwrap_or_else(|_| path.exists())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn resolve_app_folder_uses_velo_for_new_installs() {
        let temp = tempdir().unwrap();
        assert_eq!(
            resolve_app_folder(temp.path(), "com.skald.stable", false),
            RELEASE_APP_FOLDER
        );
    }

    #[test]
    fn resolve_app_folder_migrates_skald_data() {
        let temp = tempdir().unwrap();
        let legacy = temp.path().join(LEGACY_RELEASE_APP_FOLDER_V1);
        std::fs::create_dir_all(&legacy).unwrap();
        std::fs::write(legacy.join("store.json"), "{}").unwrap();
        assert_eq!(
            resolve_app_folder(temp.path(), "com.skald.stable", false),
            LEGACY_RELEASE_APP_FOLDER_V1
        );
    }

    #[test]
    fn resolve_app_folder_returns_bundle_id_for_staging() {
        assert_eq!(
            resolve_app_folder(Path::new("/tmp"), STAGING_BUNDLE_ID, false),
            STAGING_BUNDLE_ID
        );
    }

    #[test]
    fn resolve_app_folder_returns_bundle_id_in_debug_builds() {
        assert_eq!(
            resolve_app_folder(Path::new("/tmp"), "com.skald.stable", true),
            "com.skald.stable"
        );
    }
}
