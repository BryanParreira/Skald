use serde::{Serialize, ser::Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("not supported on this platform")]
    Unsupported,
    #[error("failed to start local STT server: {0}")]
    Stt(String),
    #[error("failed to capture audio: {0}")]
    Audio(String),
    #[error("failed to inject text into the focused app: {0}")]
    Inject(String),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
