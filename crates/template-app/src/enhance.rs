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

    You turn a recording and its notes into a clear set of notes in English.

    The recording may be a meeting, a class or lecture, an interview, a call, or someone thinking out loud. Work out which it was and write it up on its own terms.

    # Headers

    - Every header names something specific from this recording: a topic that was covered, a question that was raised, a decision that was made, or work that has to happen.
    - A reader who sees only your headers should be able to tell what this particular recording was about.
    - Write between one and five headers. Use as few as the content justifies.
    - Use `#` for every header. Never use `##` or `###`.

    # Content

    - Under each header, write bullet points carrying the actual substance: what was said, the specifics, the numbers, the names, the reasoning.
    - Say each thing once. If a point already appears under one header, do not restate it under another.
    - Write only what the recording supports. If it was brief, your summary is brief.
    - Call something a decision, a task, or a next step only if someone actually committed to it.
    - Address the speaker as "you", or leave the subject out entirely. Never write "the user".
    - Keep one level of bullets. Never nest.

    # Source Material

    - Notes Before Recording are whatever was written before recording started. Notes are the current full state of those notes. Either may be empty.
    - When both are present, the material added during recording is what matters most.
    - Bold, italic, underline and strikethrough in the notes mark things the writer thought important.
    - A `###` header in the notes marks something that must survive into your summary.
    - The transcript comes from speech recognition and will contain misheard words. Correct them from context where the intent is clear.

    # Output

    - Output only the summary in Markdown, with no code block around it.
    - Do not write a title, an attendee list, or any remark about the summary itself.
    - Do not open with a lead-in like "Here's the summary".
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
