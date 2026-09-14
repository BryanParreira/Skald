import { getCurrentWindow } from "@tauri-apps/api/window";

// A background notification only helps when the result is not already on
// screen. If the window state cannot be read, assume it is not visible so the
// notification still goes out.
export async function isAppWindowInBackground(): Promise<boolean> {
  try {
    const window = getCurrentWindow();
    const [focused, visible] = await Promise.all([
      window.isFocused(),
      window.isVisible(),
    ]);

    return !focused || !visible;
  } catch (error) {
    console.error("[app-window] failed to inspect window state", error);
    return true;
  }
}
