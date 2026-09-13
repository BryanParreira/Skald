use std::time::Duration;

use tauri::{AppHandle, Runtime};

const CLEANUP_TIMEOUT: Duration = Duration::from_secs(8);

const SYSTEM_PROMPT: &str = "You clean up dictated speech so it can be pasted as written text.
- Remove filler words such as um, uh, like, and you know.
- Fix punctuation and capitalization.
- When the speaker corrects themselves, keep only the correction: \"meet at 2, actually 3\" becomes \"meet at 3\".
- Keep the speaker's own words and meaning. Never add, summarize, answer, or explain anything.
- Output only the cleaned text.";

// Cleanup is best effort. Any failure, timeout, or suspicious output falls
// back to the raw transcript, because pasting slightly messy text is always
// better than pasting nothing or pasting something the user never said.
pub async fn polish<R: Runtime>(app: &AppHandle<R>, raw: &str) -> String {
    if raw.trim().is_empty() || !cleanup_enabled(app).await {
        return raw.to_string();
    }

    let Some(base_url) = local_llm_url(app).await else {
        return raw.to_string();
    };

    match request_cleanup(&base_url, raw).await {
        Ok(cleaned) if is_acceptable(raw, &cleaned) => cleaned.trim().to_string(),
        Ok(_) => {
            tracing::warn!("dictation_cleanup_rejected");
            raw.to_string()
        }
        Err(e) => {
            tracing::warn!(error = %e, "dictation_cleanup_failed");
            raw.to_string()
        }
    }
}

async fn cleanup_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    use tauri_plugin_settings::SettingsPluginExt;

    match app.settings().load().await {
        Ok(settings) => cleanup_enabled_from(&settings),
        Err(_) => true,
    }
}

// The settings file only stores values that differ from their defaults, so a
// missing key means the default. Keep this in sync with `dictation_cleanup`
// in the desktop settings store.
fn cleanup_enabled_from(settings: &serde_json::Value) -> bool {
    settings
        .pointer("/dictation/cleanup")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(true)
}

async fn local_llm_url<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    use tauri_plugin_local_llm::LocalLlmPluginExt;

    app.local_llm().server_url().await.ok().flatten()
}

async fn request_cleanup(base_url: &str, raw: &str) -> Result<String, reqwest::Error> {
    let client = reqwest::Client::builder()
        .timeout(CLEANUP_TIMEOUT)
        .build()?;

    let response: serde_json::Value = client
        .post(format!(
            "{}/chat/completions",
            base_url.trim_end_matches('/')
        ))
        .json(&request_body(raw))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(response_text(&response).unwrap_or_default())
}

fn request_body(raw: &str) -> serde_json::Value {
    serde_json::json!({
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": raw },
        ],
        "temperature": 0.0,
        "max_tokens": max_tokens_for(raw),
    })
}

fn max_tokens_for(raw: &str) -> u32 {
    let words = raw.split_whitespace().count() as u32;
    (words * 2 + 32).min(1024)
}

fn response_text(response: &serde_json::Value) -> Option<String> {
    response
        .pointer("/choices/0/message/content")?
        .as_str()
        .map(str::to_string)
}

// Guards against the model answering or commenting instead of cleaning up
// (output far longer than the input) or dropping most of what was said
// (output far shorter than the input). Removing fillers shortens text, but
// never to a quarter of its length.
fn is_acceptable(raw: &str, cleaned: &str) -> bool {
    let raw_len = raw.trim().chars().count();
    let cleaned_len = cleaned.trim().chars().count();

    if cleaned_len == 0 {
        return false;
    }

    cleaned_len <= raw_len * 3 / 2 + 40 && cleaned_len * 4 >= raw_len
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cleanup_defaults_to_enabled_when_unset() {
        assert!(cleanup_enabled_from(&serde_json::json!({})));
        assert!(cleanup_enabled_from(
            &serde_json::json!({ "dictation": {} })
        ));
    }

    #[test]
    fn cleanup_respects_explicit_setting() {
        assert!(!cleanup_enabled_from(
            &serde_json::json!({ "dictation": { "cleanup": false } })
        ));
        assert!(cleanup_enabled_from(
            &serde_json::json!({ "dictation": { "cleanup": true } })
        ));
    }

    #[test]
    fn reads_openai_compatible_response() {
        let response = serde_json::json!({
            "choices": [{ "message": { "content": "Meet at 3." } }]
        });
        assert_eq!(response_text(&response).as_deref(), Some("Meet at 3."));
        assert_eq!(response_text(&serde_json::json!({})), None);
    }

    #[test]
    fn request_carries_the_raw_text() {
        let body = request_body("um meet at two actually three");
        assert_eq!(
            body["messages"][1]["content"],
            "um meet at two actually three"
        );
        assert_eq!(body["temperature"], 0.0);
    }

    #[test]
    fn accepts_a_normal_cleanup() {
        assert!(is_acceptable(
            "um so like we should meet at two actually three",
            "We should meet at 3."
        ));
    }

    #[test]
    fn rejects_empty_output() {
        assert!(!is_acceptable("meet at three", "   "));
    }

    #[test]
    fn rejects_the_model_answering_instead_of_cleaning() {
        let raw = "what time is it";
        let chatter = "Sure! I don't have access to the current time, but you can check the clock on your device or ask a voice assistant for the exact time.";
        assert!(!is_acceptable(raw, chatter));
    }

    #[test]
    fn rejects_output_that_drops_most_of_the_text() {
        let raw = "we need to finish the quarterly report, email the vendor, and book the venue for the offsite";
        assert!(!is_acceptable(raw, "Report."));
    }
}
