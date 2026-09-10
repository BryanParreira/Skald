#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    HyprFileError(#[from] hypr_file::Error),
    #[error(transparent)]
    IoError(#[from] std::io::Error),
    #[error(transparent)]
    LmStudioError(#[from] hypr_lmstudio::Error),
    #[error("Model not downloaded")]
    ModelNotDownloaded,
    #[error("Failed to start local LLM server: {0}")]
    ServerSpawnFailed(String),
    #[error("Local LLM server did not become ready in time")]
    ServerReadinessTimeout,
    #[error("Other error: {0}")]
    Other(String),
}
