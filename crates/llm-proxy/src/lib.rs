mod analytics;
mod config;
mod env;
mod handler;
pub mod model;
mod openapi;
pub mod provider;
mod types;

pub const CHAR_TASK_HEADER: &str = "x-char-task";

pub use analytics::{AnalyticsReporter, GenerationEvent};
pub use config::*;
pub use env::{ApiKey, Env};
pub use handler::{chat_completions_router, router};
pub use model::{
    MODEL_KEY_AUDIO, MODEL_KEY_DEFAULT, MODEL_KEY_TOOL_CALLING, ModelContext, ModelResolver,
    SkaldTask, StaticModelResolver,
};
pub use openapi::openapi;
pub use skald_analytics::{AuthenticatedUserId, DeviceFingerprint};
