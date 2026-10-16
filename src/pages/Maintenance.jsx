import React from "react";

import {
  formatDateTime,
  PageFrame,
  PageHeader,
  PrimaryButton,
} from "./inc/PagesComponents";

// ==========================================================
// SCHEDULE CARD STYLES  (edit colours / labels here)
// ==========================================================

const SCHEDULE_CARDS = {
  start: {
    label: "Started At",
    box: "border-blue-200/80 bg-blue-50/60",
    labelText: "text-blue-700",
    dateText: "text-blue-700",
    timeText: "text-blue-900",
  },
  end: {
    label: "Expected End",
    box: "border-rose-200/80 bg-rose-50/60",
    labelText: "text-rose-700",
    dateText: "text-rose-700",
    timeText: "text-rose-900",
  },
};

function ScheduleCard({ tone, dateTime }) {
  const style = SCHEDULE_CARDS[tone];

  return (
    <div
      className={`rounded-2xl p-3.5 text-center shadow-xs`}
    >
      <span
        className={`text-lg font-bold uppercase tracking-wider ${style.labelText}`}
      >
        {style.label}
      </span>

      <span className={`block text-sm font-medium`}>
        {dateTime.date}
      </span>

      <span className={`mt-1 block text-sm font-bold`}>
        {dateTime.time}
      </span>
    </div>
  );
}

function MaintenanceSchedule({
  startTime,
  endTime,
  maintenanceDateFormat,
  maintenanceTimeFormat,
}) {
  const format = (value) =>
    formatDateTime(value, maintenanceDateFormat, maintenanceTimeFormat);

  const start = format(startTime);
  const end = format(endTime);

  if (!start && !end) return null;

  return (
    <div
      className={`mt-5 grid gap-3 ${start && end ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {start && <ScheduleCard tone="start" dateTime={start} />}
      {end && <ScheduleCard tone="end" dateTime={end} />}
    </div>
  );
}

// ==========================================================
// MAINTENANCE PAGE
// ==========================================================

export default function Maintenance({
  siteName,
  siteCopyright,
  logoUrl,
  backgroundUrl,
  backgroundStyle,
  maintenanceTitle,
  maintenanceSubject,
  maintenanceStartTime,
  maintenanceEndTime,
  maintenanceMessage,
  maintenanceDateFormat,
  maintenanceTimeFormat,
  onRefresh,
  isRefreshing,
}) {
  const settings = {
    systemName: siteName,
    siteCopyright,
    logoUrl,
    backgroundUrl,
    backgroundStyle,
  };

  return (
    <PageFrame settings={settings} darkOverlay>
      <PageHeader
        settings={settings}
        maintenance
        title={maintenanceTitle}
        subtitle={siteName}
      />

      <MaintenanceSchedule
        startTime={maintenanceStartTime}
        endTime={maintenanceEndTime}
        maintenanceDateFormat={maintenanceDateFormat}
        maintenanceTimeFormat={maintenanceTimeFormat}
      />

      <div className="m-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4">
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
          {maintenanceSubject}
        </p>
        {maintenanceMessage && (
          <p className="mt-1 text-sm leading-5 text-slate-600"
            dangerouslySetInnerHTML={{
                __html: maintenanceMessage,
              }}
              />
            )}
      </div>

      <PrimaryButton
        type="button"
        icon="bi-arrow-clockwise"
        loading={isRefreshing}
        loadingText="Checking..."
        onClick={onRefresh}
      >
        Check Again
      </PrimaryButton>
    </PageFrame>
  );
}
