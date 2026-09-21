use std::path::Path;
use std::sync::OnceLock;

use envy::Error as EnvyError;
use serde::Deserialize;

fn default_port() -> u16 {
    3001
}

#[derive(Deserialize)]
pub struct Env {
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default, deserialize_with = "notiz_api_env::filter_empty")]
    pub sentry_dsn: Option<String>,
    #[serde(default, deserialize_with = "notiz_api_env::filter_empty")]
    pub posthog_api_key: Option<String>,

    #[serde(flatten)]
    pub observability: crate::observability::Env,

    #[serde(flatten)]
    pub supabase: notiz_api_env::SupabaseEnv,
    #[serde(flatten)]
    pub nango: notiz_api_env::NangoEnv,
    #[serde(flatten)]
    pub stripe: notiz_api_env::StripeEnv,
    #[serde(flatten)]
    pub pyannote: notiz_api_env::PyannoteEnv,
    #[serde(flatten)]
    pub github_app: notiz_api_support::GitHubAppEnv,
    #[serde(flatten)]
    pub support_database: notiz_api_support::SupportDatabaseEnv,
    #[serde(flatten)]
    pub chatwoot: notiz_api_support::ChatwootEnv,

    pub exa_api_key: String,
    pub jina_api_key: String,

    #[serde(flatten)]
    pub loops: notiz_api_env::LoopsEnv,

    #[serde(flatten)]
    pub llm: notiz_llm_proxy::Env,
    #[serde(flatten)]
    pub stt: notiz_transcribe_proxy::Env,
}

static ENV: OnceLock<Env> = OnceLock::new();

pub fn env() -> &'static Env {
    ENV.get_or_init(|| {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let repo_root = manifest_dir
            .parent()
            .and_then(|p| p.parent())
            .unwrap_or(manifest_dir);

        let _ = dotenvy::from_path(repo_root.join(".env.supabase"));
        let _ = dotenvy::from_path(manifest_dir.join(".env"));
        let env: Env =
            envy::from_env().unwrap_or_else(|error| panic!("{}", format_env_error(error)));
        validate_env(&env);
        env
    })
}

fn validate_env(env: &Env) {
    if !cfg!(debug_assertions) && is_stripe_test_key(&env.stripe.stripe_secret_key) {
        panic!("Failed to load environment: STRIPE_SECRET_KEY must be a live key in production");
    }
}

fn is_stripe_test_key(key: &str) -> bool {
    key.starts_with("sk_test_") || key.starts_with("rk_test_")
}

fn format_env_error(error: EnvyError) -> String {
    match error {
        EnvyError::MissingValue(field) => {
            let env_var = field_name_to_env_var(&field);
            format!("Failed to load environment: missing {env_var} (field: {field})")
        }
        other => format!("Failed to load environment: {other}"),
    }
}

fn field_name_to_env_var(field: &str) -> String {
    field
        .chars()
        .flat_map(|ch| ch.to_uppercase())
        .collect::<String>()
}
