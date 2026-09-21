use std::path::{Path, PathBuf};

pub const VAULT_CONFIG_FILENAME: &str = "global.json";
const STAGING_BUNDLE_ID: &str = "com.notiz.staging";
const RELEASE_APP_FOLDER: &str = "com.notiz.app";
// Newest first: the app was previously shipped as Skald, Velo, Anarlog and Hyprnote.
const LEGACY_RELEASE_APP_FOLDERS: &[&str] =
    &["com.skald.app", "com.velo.app", "anarlog", "hyprnote"];

pub fn compute_vault_config_path(base: &Path) -> PathBuf {
    base.join(VAULT_CONFIG_FILENAME)
}

pub fn compute_default_base(bundle_id: &str) -> Option<PathBuf> {
    let data_dir = dirs::data_dir()?;
    let app_folder = resolve_app_folder(&data_dir, bundle_id, cfg!(debug_assertions));
    Some(data_dir.join(app_folder))
}

fn resolve_app_folder(data_dir: &Path, bundle_id: &str, is_debug: bool) -> String {
    if is_debug || bundle_id == STAGING_BUNDLE_ID {
        return bundle_id.to_string();
    }

    if has_app_data(&data_dir.join(RELEASE_APP_FOLDER)) {
        return RELEASE_APP_FOLDER.to_string();
    }

    LEGACY_RELEASE_APP_FOLDERS
        .iter()
        .find(|folder| has_app_data(&data_dir.join(folder)))
        .unwrap_or(&RELEASE_APP_FOLDER)
        .to_string()
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
    fn resolve_app_folder_uses_release_folder_for_new_installs() {
        let temp = tempdir().unwrap();
        assert_eq!(
            resolve_app_folder(temp.path(), "com.notiz.stable", false),
            RELEASE_APP_FOLDER
        );
    }

    #[test]
    fn resolve_app_folder_keeps_using_newest_legacy_folder() {
        let temp = tempdir().unwrap();
        for folder in ["com.skald.app", "com.velo.app"] {
            let legacy = temp.path().join(folder);
            std::fs::create_dir_all(&legacy).unwrap();
            std::fs::write(legacy.join("store.json"), "{}").unwrap();
        }
        assert_eq!(
            resolve_app_folder(temp.path(), "com.notiz.stable", false),
            "com.skald.app"
        );
    }

    #[test]
    fn resolve_app_folder_prefers_release_folder_once_it_has_data() {
        let temp = tempdir().unwrap();
        for folder in [RELEASE_APP_FOLDER, "com.skald.app"] {
            let dir = temp.path().join(folder);
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(dir.join("store.json"), "{}").unwrap();
        }
        assert_eq!(
            resolve_app_folder(temp.path(), "com.notiz.stable", false),
            RELEASE_APP_FOLDER
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
            resolve_app_folder(Path::new("/tmp"), "com.notiz.stable", true),
            "com.notiz.stable"
        );
    }
}
