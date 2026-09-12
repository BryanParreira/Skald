import { type ReactNode, useId } from "react";

import { Switch } from "@hypr/ui/components/ui/switch";

interface SettingItem {
  value: boolean;
  onChange: (value: boolean) => void;
}

interface AppSettingsViewProps {
  autostart: SettingItem;
  autoStartScheduledMeetings: SettingItem;
  autoStopMeetings: SettingItem;
  floatingBar: SettingItem;
  liveCaption: SettingItem;
  showAppInDock: SettingItem;
  showTrayIcon: SettingItem;
}

export function AppSettingsView({
  autostart,
  autoStartScheduledMeetings,
  autoStopMeetings,
  floatingBar,
  liveCaption,
  showAppInDock,
  showTrayIcon,
}: AppSettingsViewProps) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex flex-col gap-4">
          <SettingRow
            title="Start Velo at login"
            description="Always ready without manually launching."
            checked={autostart.value}
            onChange={autostart.onChange}
          />
          <SettingRow
            title="Show app in Dock"
            description="Show Velo in the Dock and app switcher."
            checked={showAppInDock.value}
            onChange={showAppInDock.onChange}
          />
          <SettingRow
            title="Show tray icon"
            description="Keep Velo available from the menu bar."
            checked={showTrayIcon.value}
            onChange={showTrayIcon.onChange}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-sans text-lg font-semibold">Meetings</h2>
        <div className="flex flex-col gap-4">
          <SettingRow
            title="Start when meeting begins"
            description="Automatically start listening when an event-backed note reaches its scheduled start time."
            checked={autoStartScheduledMeetings.value}
            onChange={autoStartScheduledMeetings.onChange}
          />
          <SettingRow
            title="Stop when meeting ends"
            description="Automatically stop listening when the meeting app releases the microphone."
            checked={autoStopMeetings.value}
            onChange={autoStopMeetings.onChange}
          />
          <SettingRow
            title="Show floating bar"
            description="Show the compact floating control while listening."
            checked={floatingBar.value}
            onChange={floatingBar.onChange}
          />
          <SettingRow
            title="Show live transcript overlay"
            description="Show the live transcript overlay by default while listening."
            checked={liveCaption.value}
            onChange={liveCaption.onChange}
          />
        </div>
      </section>
    </div>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: ReactNode;
  description: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <h3 id={titleId} className="mb-1 text-sm font-medium">
          {title}
        </h3>
        <p id={descriptionId} className="text-muted-foreground text-xs">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      />
    </div>
  );
}
