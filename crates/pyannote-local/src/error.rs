use serde::{Serialize, ser::Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    SkaldOnnxError(#[from] skald_onnx::Error),
    #[error(transparent)]
    OrtError(#[from] skald_onnx::ort::Error),
    #[error(transparent)]
    ShapeError(#[from] skald_onnx::ndarray::ShapeError),
    #[error("knf error: {0}")]
    KnfError(String),
    #[error("empty row in outputs")]
    EmptyRowError,
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
