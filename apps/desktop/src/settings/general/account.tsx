import { Trans } from "@lingui/react/macro";

import { SettingsPageTitle } from "~/settings/page-title";

export function SettingsAccount() {
  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle title={<Trans>Account</Trans>} />
      <section className="pb-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            <Trans>Skald</Trans>
          </h3>
          <p className="text-muted-foreground text-sm">
            <Trans>Running locally. No account required.</Trans>
          </p>
        </div>
      </section>
    </div>
  );
}
