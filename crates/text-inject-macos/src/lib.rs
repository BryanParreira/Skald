use std::{ffi::c_void, thread, time::Duration};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("failed to create CGEventSource (check Accessibility/Input Monitoring permissions)")]
    SourceCreate,
    #[error("failed to create CGEvent for keycode {0}")]
    EventCreate(u16),
}

/// Simulates Cmd+V in the frontmost app. Callers are responsible for placing
/// the text to paste on the system clipboard first (and restoring whatever
/// was there afterward, since this only presses the keys).
pub fn paste() -> Result<(), Error> {
    unsafe {
        let source = CGEventSourceCreate(KCG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE);
        if source.is_null() {
            return Err(Error::SourceCreate);
        }

        let key_down = CGEventCreateKeyboardEvent(source, KEYCODE_V, true);
        let key_up = CGEventCreateKeyboardEvent(source, KEYCODE_V, false);

        if key_down.is_null() || key_up.is_null() {
            if !key_down.is_null() {
                CFRelease(key_down as *const c_void);
            }
            if !key_up.is_null() {
                CFRelease(key_up as *const c_void);
            }
            CFRelease(source as *const c_void);
            return Err(Error::EventCreate(KEYCODE_V));
        }

        CGEventSetFlags(key_down, FLAG_COMMAND);
        CGEventSetFlags(key_up, FLAG_COMMAND);

        CGEventPost(KCG_HID_EVENT_TAP, key_down);
        thread::sleep(Duration::from_millis(15));
        CGEventPost(KCG_HID_EVENT_TAP, key_up);

        CFRelease(key_down as *const c_void);
        CFRelease(key_up as *const c_void);
        CFRelease(source as *const c_void);
    }

    Ok(())
}

const KEYCODE_V: u16 = 9;
const FLAG_COMMAND: u64 = 1 << 20;

const KCG_HID_EVENT_TAP: u32 = 0;
const KCG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE: i32 = 1;

#[link(name = "CoreGraphics", kind = "framework")]
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CGEventSourceCreate(state_id: i32) -> *mut c_void;
    fn CGEventCreateKeyboardEvent(source: *mut c_void, keycode: u16, key_down: bool)
    -> *mut c_void;
    fn CGEventSetFlags(event: *mut c_void, flags: u64);
    fn CGEventPost(tap: u32, event: *mut c_void);
    fn CFRelease(cf: *const c_void);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_source_creation_succeeds() {
        // Doesn't require Accessibility permission (no event is posted), just
        // confirms the FFI signatures link and the source lifecycle is sound.
        unsafe {
            let source = CGEventSourceCreate(KCG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE);
            assert!(!source.is_null());
            CFRelease(source as *const c_void);
        }
    }

    #[test]
    #[ignore = "posts a real keystroke into the focused app; requires Accessibility \
                permission and a manual check of what received the paste"]
    fn paste_does_not_error() {
        paste().unwrap();
    }
}
