import React, { useState } from "react";
import { useAppSettings } from "../../assets/js/useAppSettings";
import { SettingsLoading } from "./PagesComponents";
import { DEFAULT_SITE_NAME } from "./pageUtils";
import Maintenance from "../Maintenance";

export default function PageShell({ children }) {
  const settings = useAppSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const systemName = settings.siteName || DEFAULT_SITE_NAME;

  const handleRefresh = () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    window.setTimeout(() => window.location.reload(), 300);
  };

  if (settings.settingsLoading) {
    return <SettingsLoading />;
  }

  if (settings.isUnderMaintenance) {
    return (
      <Maintenance
        {...settings}
        siteName={systemName}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
    );
  }

  return children({ ...settings, systemName });
}
