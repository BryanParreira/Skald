use crate::{EnhanceTemplate, Participant, Session, Transcript, common_derives};
use notiz_askama_utils::filters;

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
    use notiz_askama_utils::{tpl_assert, tpl_snapshot};

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

    # Structure

    Write one `#` section for each distinct subject the recording covered, in the order the subjects came up. A subject is one thing that was talked about: a particular assignment, a particular exam, a particular person to contact, a particular problem to solve.

    - Name each header after its subject. A reader seeing only your headers should know what was discussed.
    - Every bullet sits under the header that names its subject. A point about contacting someone does not belong under a header about an assignment. If a point fits no existing header, give it its own.
    - Two or more sections when the recording covered two or more subjects in some depth. A short recording that only names a few things in passing is one section.
    - Give each section at least two bullets. If a subject only warrants one line, fold it into a related section rather than giving it its own.
    - Use `#` for every header. Never use `##` or `###`.
    - Every header names a real subject. Never write a header like "Subjects", "Summary", "Overview", or "Topics".

    # Content

    - Under each header, write flat `-` bullets, every one at the same indentation. Never indent a bullet under another bullet. If a point needs sub-points, write them as more bullets at the same level.
    - Carry the specifics across: dates, times, numbers, names, chapter and problem numbers, and what someone said they did or did not understand.
    - Write each bullet as a full statement, not a label. "Problem sets 5 and 6 are not started, and 6 covers eigenvalues" beats "Problem set 6".
    - Cover everything of consequence that was said. If the speaker mentioned it, it belongs somewhere.
    - Keep hedges. If a date, number or fact was stated as uncertain, write it as uncertain rather than picking one option: "due Tuesday or Wednesday, still to confirm" rather than "due Tuesday".
    - Say each thing once. If you have already written a point under one header, do not write it again under another.
    - Call something a decision, a task, or a next step only if someone actually committed to it.

    # Source Material

    - Notes Before Recording are whatever was written before recording started. Notes are the current full state of those notes. Either may be empty.
    - When both are present, the material added during recording is what matters most.
    - Bold, italic, underline and strikethrough in the notes mark things the writer thought important.
    - A `###` header in the notes marks something that must survive into your summary.
    - The transcript comes from speech recognition and will contain misheard words. Correct one only when the intended word is obvious from the surrounding sentence.
    - Never invent a meaning for a garbled phrase. If you cannot tell what was meant, repeat the words as they appear rather than guessing at a plausible topic.
    - Add nothing that was not said. No advice, no filler, no assumed context.

    # Output

    - Output only the summary in Markdown, with no code block around it.
    - Do not write a title, an attendee list, or any remark about the summary itself.
    - Do not open with a lead-in like "Here's the summary".
    - These are the speaker's own notes, so never narrate them in the third person. No bullet may contain the words "the speaker" or "the user". Write about the work itself. Using an unrelated topic to show the form only:

      - "The deposit is still unpaid." not "The speaker has not paid the deposit."
      - "The venue holds 80 people." not "The user said the venue holds 80 people."

    - Write anything still to be done as a plain instruction beginning with a verb, again showing form on an unrelated topic: "Call the caterer to confirm the headcount.", "Send the deposit before the end of the month."
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
