mod auth_callback;
mod billing_refresh;
mod integration_callback;
mod notes_open;

pub use auth_callback::*;
pub use billing_refresh::*;
pub use integration_callback::*;
pub use notes_open::*;

use serde::{Deserialize, Serialize};
use specta::Type;
use std::str::FromStr;

#[derive(Debug, Clone, serde::Serialize, specta::Type, tauri_specta::Event)]
pub struct DeepLinkEvent(pub DeepLink);

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "to", content = "search")]
pub enum DeepLink {
    #[serde(rename = "/auth/callback")]
    AuthCallback(AuthCallbackSearch),
    #[serde(rename = "/billing/refresh")]
    BillingRefresh(BillingRefreshSearch),
    #[serde(rename = "/integration/callback")]
    IntegrationCallback(IntegrationCallbackSearch),
    #[serde(rename = "/notes/open")]
    NotesOpen(NotesOpenSearch),
}

impl DeepLink {
    pub fn path(&self) -> &'static str {
        match self {
            DeepLink::AuthCallback(_) => "/auth/callback",
            DeepLink::BillingRefresh(_) => "/billing/refresh",
            DeepLink::IntegrationCallback(_) => "/integration/callback",
            DeepLink::NotesOpen(_) => "/notes/open",
        }
    }
}

impl FromStr for DeepLink {
    type Err = crate::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parsed = url::Url::parse(s)?;

        let host = parsed.host_str().unwrap_or("");
        let path = parsed.path().trim_start_matches('/');
        let full_path = if path.is_empty() {
            host.to_string()
        } else {
            format!("{}/{}", host, path)
        };

        let query = parsed.query().unwrap_or("");

        match full_path.as_str() {
            "auth/callback" => Ok(DeepLink::AuthCallback(serde_qs::from_str(query)?)),
            "billing/refresh" => Ok(DeepLink::BillingRefresh(serde_qs::from_str(query)?)),
            "integration/callback" => Ok(DeepLink::IntegrationCallback(serde_qs::from_str(query)?)),
            "notes/open" => Ok(DeepLink::NotesOpen(serde_qs::from_str(query)?)),
            _ => Err(crate::Error::UnknownPath(full_path)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_notes_open() {
        let link: DeepLink = "notiz://notes/open?session_id=abc-123".parse().unwrap();
        match link {
            DeepLink::NotesOpen(search) => assert_eq!(search.session_id, "abc-123"),
            other => panic!("unexpected deep link: {other:?}"),
        }
    }

    // Reminders created from action items carry a task_id so duplicates can be
    // detected; the route must still open the note rather than reject the link.
    #[test]
    fn parses_notes_open_with_extra_params() {
        let link: DeepLink = "notiz://notes/open?session_id=abc-123&task_id=t-1"
            .parse()
            .unwrap();
        assert_eq!(link.path(), "/notes/open");
    }

    #[test]
    fn rejects_notes_open_without_session_id() {
        assert!("notiz://notes/open".parse::<DeepLink>().is_err());
    }
}
