import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hypr/ui/components/ui/select";

import { SettingRow } from "~/settings/general/app-settings";
import { PermissionRow } from "~/settings/general/permissions";
import { SettingsPageTitle } from "~/settings/page-title";
import { usePermission } from "~/shared/hooks/usePermissions";
import * as settings from "~/store/tinybase/store/settings";

export function SettingsDictation() {
  const { t } = useLingui();
  const store = settings.UI.useStore(settings.STORE_ID);

  const enabled =
    settings.UI.useValue("dictation_enabled", settings.STORE_ID) === true;
  const hotkey =
    (settings.UI.useValue("dictation_hotkey", settings.STORE_ID) as
      | string
      | undefined) ?? "fn";
  const cleanup =
    settings.UI.useValue("dictation_cleanup", settings.STORE_ID) !== false;

  const setEnabled = settings.UI.useSetValueCallback(
    "dictation_enabled",
    (value: boolean) => value,
    [],
    settings.STORE_ID,
  );
  const setHotkey = settings.UI.useSetValueCallback(
    "dictation_hotkey",
    (value: string) => value,
    [],
    settings.STORE_ID,
  );
  const setCleanup = settings.UI.useSetValueCallback(
    "dictation_cleanup",
    (value: boolean) => value,
    [],
    settings.STORE_ID,
  );

  const accessibility = usePermission("accessibility");
  const inputMonitoring = usePermission("inputMonitoring");
  const hasAccess =
    accessibility.status === "authorized" &&
    inputMonitoring.status === "authorized";

  // macOS refuses to create the key listener until access is granted, so a
  // hotkey enabled before granting fails once and stays dead. Re-register as
  // soon as access arrives.
  useEffect(() => {
    if (store && enabled && hasAccess) {
      settings.syncDictationHotkey(store);
    }
  }, [store, enabled, hasAccess]);

  return (
    <div className="flex flex-col gap-8">
      <SettingsPageTitle title={<Trans>Dictation</Trans>} />

      <section className="flex flex-col gap-4">
        <SettingRow
          title={t`Enable dictation`}
          description={t`Hold the hotkey, speak, and release to type into any app.`}
          checked={enabled}
          onChange={setEnabled}
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-medium">
              <Trans>Hotkey</Trans>
            </h3>
            <p className="text-muted-foreground text-xs">
              <Trans>Hold to record. Release to paste.</Trans>
            </p>
          </div>
          <Select value={hotkey} onValueChange={setHotkey} disabled={!enabled}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fn">{t`Fn`}</SelectItem>
              <SelectItem value="option">{t`Option`}</SelectItem>
              <SelectItem value="control_option">{t`Control + Option`}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SettingRow
          title={t`Clean up text`}
          description={t`Remove filler words, fix punctuation, and keep your self-corrections. Uses the on-device model when it is running, and pastes your exact words otherwise.`}
          checked={cleanup}
          onChange={setCleanup}
        />
      </section>

      {enabled && !hasAccess && (
        <section className="flex flex-col gap-4">
          <PermissionRow
            title={t`Accessibility`}
            description={t`Required to detect the hotkey and paste text into other apps`}
            status={accessibility.status}
            isPending={accessibility.isPending}
            onRequest={accessibility.request}
            onReset={accessibility.reset}
            onOpen={accessibility.open}
          />
          <PermissionRow
            title={t`Input Monitoring`}
            description={t`Required to notice when you press and release the hotkey`}
            status={inputMonitoring.status}
            isPending={inputMonitoring.isPending}
            onRequest={inputMonitoring.request}
            onReset={inputMonitoring.reset}
            onOpen={inputMonitoring.open}
          />
        </section>
      )}
    </div>
  );
}
