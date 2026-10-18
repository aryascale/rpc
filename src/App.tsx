import { useState } from "react";
import { loadSettings, saveSettings, type AppSettings } from "./lib/settings";
import { type CsvData, getSampleData } from "./lib/csv";
import SettingsMode from "./modes/SettingsMode";
import DisplayMode from "./modes/DisplayMode";

type AppMode = "settings" | "display";

export default function App() {
  const [mode, setMode] = useState<AppMode>("settings");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [data, setData] = useState<CsvData | null>(() => getSampleData());

  function handleSettingsChange(s: AppSettings) {
    setSettings(s);
    saveSettings(s);
  }

  if (mode === "display") {
    return (
      <DisplayMode
        data={data}
        settings={settings}
        onExit={() => setMode("settings")}
      />
    );
  }

  return (
    <SettingsMode
      settings={settings}
      data={data}
      onSettingsChange={handleSettingsChange}
      onDataChange={setData}
      onLaunch={() => setMode("display")}
    />
  );
}
