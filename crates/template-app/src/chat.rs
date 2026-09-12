use crate::{Event, Participant, Transcript, common_derives};
#[allow(unused_imports)]
use hypr_askama_utils::filters;

common_derives! {
    pub struct SessionContext {
        pub title: Option<String>,
        pub date: Option<String>,
        pub raw_content: Option<String>,
        pub enhanced_content: Option<String>,
        pub transcript: Option<Transcript>,
        pub participants: Vec<Participant>,
        pub event: Option<Event>,
    }
}

common_derives! {
    #[derive(askama::Template)]
    #[template(path = "chat.system.md.jinja")]
    pub struct ChatSystem {
        pub language: Option<String>,
    }
}

common_derives! {
    #[derive(askama::Template)]
    #[template(path = "context.block.md.jinja")]
    pub struct ContextBlock {
        pub contexts: Vec<SessionContext>,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hypr_askama_utils::tpl_snapshot_with_assert;

    tpl_snapshot_with_assert!(
        test_chat_system,
        ChatSystem {
            language: None,
        },
        |v| !v.contains("Context:"),
        fixed_date = "2025-01-01",
        @"
    # General Instructions

    Current date: 2025-01-01

    - You are Velo AI, a helpful AI meeting assistant in Velo, an intelligent meeting platform that transcribes and analyzes meetings. Your purpose is to help users understand their meeting content better.
    - If the user asks for your name or identity, say your name is Velo AI.
    - Always respond in English, unless the user explicitly asks for a different language.
    - Transcript language, source-note language, quoted text, previous assistant messages, and additional spoken-language settings are context only; do not use them to choose your response language.
    - Always keep your responses concise, professional, and directly relevant to the user's questions.
    - Your primary source of truth is the meeting transcript. Try to generate responses primarily from the transcript, and then the summary or other information (unless the user asks for something specific).

    # Formatting Guidelines

    - Write your response as plain, normal prose — do not wrap it in a ``` code block.
    - The one exception: if the user explicitly asks you to rewrite or produce a new version of the meeting note, put that rewritten note (and only that) inside a single ``` markdown code block. Never leave that block empty.
    - Everything else — explanations, summaries, answers, general conversation — is plain text, never inside ``` blocks.
    ");

    tpl_snapshot_with_assert!(
        test_context_block_wrapped,
        ContextBlock {
            contexts: vec![SessionContext {
                title: Some("Q1 Planning".to_string()),
                date: Some("2025-03-01".to_string()),
                raw_content: None,
                enhanced_content: Some("Summary of Q1 goals.".to_string()),
                transcript: None,
                participants: vec![],
                event: None,
            }],
        },
        |v| v.starts_with("<context>") && v.trim_end().ends_with("</context>"),
        @"
    <context>

    Title: Q1 Planning

    Date: 2025-03-01

    Enhanced Summary:
    Summary of Q1 goals.
    </context>
    ");
}
