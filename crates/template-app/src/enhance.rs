use crate::{EnhanceTemplate, Participant, Session, Transcript, common_derives};
use hypr_askama_utils::filters;

common_derives! {
    #[derive(askama::Template)]
    #[template(path = "enhance.system.md.jinja")]
    pub struct EnhanceSystem {
        pub language: Option<String>,
    }
}

common_derives! {
    #[derive(askama::Template)]
    #[template(path = "enhance.user.md.jinja")]
    pub struct EnhanceUser {
        pub session: Session,
        pub participants: Vec<Participant>,
        pub template: Option<EnhanceTemplate>,
        pub transcripts: Vec<Transcript>,
        pub pre_meeting_memo: String,
        pub post_meeting_memo: String,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Segment, TemplateSection};
    use hypr_askama_utils::{tpl_assert, tpl_snapshot};

    tpl_assert!(
        test_language_as_specified,
        EnhanceSystem {
            language: Some("ko".to_string()),
        },
        |v| { v.contains("Korean") }
    );

    tpl_snapshot!(
        test_enhance_system_formatting,
        EnhanceSystem { language: None },
        fixed_date = "2025-01-01",
        @r#"
    # General Instructions

    Current date: 2025-01-01

    You are an expert at creating structured, comprehensive summaries of recorded sessions in English. Maintain accuracy, completeness, and appropriate terminology.

    A session is any recording the user captured: a meeting, a lecture or class, an interview, a one-on-one, a phone call, a personal voice memo, or unstructured thinking out loud. Infer what kind of session this actually was from the notes and transcript, and summarize it on its own terms.

    # Format Requirements

    - Use Markdown format without code block wrappers.
    - Structure with # (h1) headings for main topics and bullet points for content.
    - Use only h1 headers. Do not use h2 or h3. Each header represents a section.
    - Each section should have at least 3 detailed bullet points.
    - Focus list items on specific discussion details, decisions, and key points, not general topics.
    - Maintain a consistent list hierarchy:
      - Use bullet points at the same level unless an example or clarification is absolutely necessary.
      - Avoid nesting lists beyond one level of indentation.
      - If additional structure is required, break the information into separate sections with new h1 headings instead of deeper indentation.
    - Your final output MUST be ONLY the markdown summary itself.
    - Do not include any explanations, commentary, or meta-discussion.
    - Do not say things like "Here's the summary" or "I've analyzed".

    # About Notes

    - Notes Before Recording are a snapshot of whatever the user had written before recording started. This may be an agenda, but it may equally be a topic heading, a few loose thoughts, or nothing at all.
    - Notes are the full current state of the user's notes, which may include the earlier content plus anything added while recording.
    - When both sections are present, focus on what changed or was added in Notes compared to Notes Before Recording to understand what the user captured during the session.
    - Either section may sometimes be empty.

    # Guidelines

    - Notes and transcript may contain errors made by human and STT, respectively. Make the best out of every material.
    - Do not include the note title, attendee lists nor explanatory notes about the output structure.
    - Do not create generic opening sections such as "Overview", "Meeting Overview", "Introduction", or "Participants" unless the session itself was explicitly about those topics.
    - Do not impose meeting scaffolding on content that is not a meeting. Section headers must come from what was actually discussed, not from a fixed template. Never emit headers such as "Meeting Summary", "Pre-Meeting Notes", "Meeting Notes", "Agenda", "Attendees", "Decisions and Actions", or "Action Items" unless the session genuinely contained that material.
    - Match the vocabulary to the session. A lecture has topics and explanations, not agenda items. A voice memo has thoughts, not decisions. Only describe something as a decision, action item, or follow-up when someone actually committed to it.
    - Use Notes Before Recording to understand the user's intent. In Notes, focus on content that was added or changed compared to Notes Before Recording. Naturally integrate entries into relevant sections instead of forcefully converting them into headers.
    - Preserve essential details; avoid excessive abstraction. Ensure content remains concrete and specific.
    - Pay close attention to emphasized text in notes. Users highlight information using four styles: bold(**text**), italic(_text_), underline(<u>text</u>), strikethrough(~~text~~).
    - Recognize H3 headers (### Header) in notes—these indicate highly important topics that the user wants to retain no matter what.
    "#);

    tpl_snapshot!(
        test_enhance_user_formatting_1,
        EnhanceUser {
            session: Session {
                title: Some("Meeting".to_string()),
                started_at: None,
                ended_at: None,
                event: None,
            },
            participants: vec![
                Participant {
                    name: "John Doe".to_string(),
                    job_title: Some("CEO".to_string()),
                },
                Participant {
                    name: "Jane Smith".to_string(),
                    job_title: Some("CTO".to_string()),
                },
            ],
            template: Some(EnhanceTemplate {
                title: "Meeting".to_string(),
                description: Some("Meeting description".to_string()),
                sections: vec![
                    TemplateSection {
                        title: "Section 1".to_string(),
                        description: Some("Section 1 description".to_string()),
                    },
                    TemplateSection {
                        title: "Section 2".to_string(),
                        description: Some("Section 2 description".to_string()),
                    },
                ],
            }),
            transcripts: vec![Transcript {
                segments: vec![Segment {
                    text: "Hello".to_string(),
                    speaker: "John Doe".to_string(),
                }],
                started_at: Some(1719859200),
                ended_at: Some(1719862800),
            }],
            pre_meeting_memo: String::new(),
            post_meeting_memo: String::new(),
        }, @"
    # Context


    Session: Meeting
    Participants:
    - John Doe (CEO)
      - Jane Smith (CTO)
      



    # Transcript


    John Doe: Hello

    # Output Template

    # Summary Template

    Name: Meeting
    Description: Meeting description

    Sections:
    1. Section 1 - Section 1 description
    2. Section 2 - Section 2 description
    ");

    tpl_snapshot!(
        test_enhance_user_with_memos,
        EnhanceUser {
            session: Session {
                title: Some("Standup".to_string()),
                started_at: None,
                ended_at: None,
                event: None,
            },
            participants: vec![],
            template: None,
            transcripts: vec![Transcript {
                segments: vec![Segment {
                    text: "Shipped the feature".to_string(),
                    speaker: "Alice".to_string(),
                }],
                started_at: None,
                ended_at: None,
            }],
            pre_meeting_memo: "- follow up on PR review\n- align on priorities".to_string(),
            post_meeting_memo: "- check CI\n- ship before EOD".to_string(),
        }, @"
    # Context


    Session: Standup


    # Notes Before Recording

    - follow up on PR review
    - align on priorities



    # Notes

    - check CI
    - ship before EOD


    # Transcript


    Alice: Shipped the feature

    # Output Template

    # Instructions

    1. Analyze the content and decide the sections to use.
    2. Generate a well-formatted markdown summary.
    "
    );
}
