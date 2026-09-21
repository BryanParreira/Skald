import { Icon } from "@iconify-icon/react";
import { Trans } from "@lingui/react/macro";

import { commands as openerCommands } from "@notiz/plugin-opener2";
import { commands as sfxCommands } from "@notiz/plugin-sfx";

import { OnboardingButton } from "./shared";

import { flushAutomaticRelaunch } from "~/store/tinybase/store/save";
import { commands } from "~/types/tauri.gen";

const SOCIALS = [
  {
    label: "GitHub",
    icon: "simple-icons:github",
    url: "https://github.com/BryanParreira/Notiz",
  },
] as const;

const SOCIAL_ICON_SIZE = 18;

export function FinalDescription() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span>
        <Trans>Star us on GitHub:</Trans>
      </span>
      <div className="flex items-center gap-2">
        {SOCIALS.map((social) => (
          <button
            key={social.label}
            onClick={() => void openerCommands.openUrl(social.url, null)}
            className="text-muted-foreground hover:text-muted-foreground inline-flex size-5 items-center justify-center rounded-md transition-colors duration-150"
            aria-label={social.label}
          >
            <Icon
              icon={social.icon}
              width={SOCIAL_ICON_SIZE}
              height={SOCIAL_ICON_SIZE}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FinalSection({ onContinue }: { onContinue: () => void }) {
  return (
    <OnboardingButton
      className="px-6 py-2 text-sm"
      onClick={() => void finishOnboarding(onContinue)}
    >
      <Trans>Open Notiz</Trans>
    </OnboardingButton>
  );
}

export async function finishOnboarding(onContinue?: () => void) {
  await sfxCommands.stop("BGM").catch(console.error);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await commands.setOnboardingNeeded(false).catch(console.error);
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (await flushAutomaticRelaunch()) {
    return;
  }
  onContinue?.();
}
