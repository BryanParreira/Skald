#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    pub model: crate::SupportedModel,
    pub status: notiz_model_downloader::DownloadStatus,
}
