"use client";

import React from "react";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trainerThemeCss = `
    .trainer-app {
      --heroui-primary-50: 248 250 252 !important;
      --heroui-primary-100: 241 245 249 !important;
      --heroui-primary-200: 226 232 240 !important;
      --heroui-primary-300: 203 213 225 !important;
      --heroui-primary-400: 148 163 184 !important;
      --heroui-primary-500: 100 116 139 !important;
      --heroui-primary-600: 71 85 105 !important;
      --heroui-primary-700: 51 65 85 !important;
      --heroui-primary-800: 30 41 59 !important;
      --heroui-primary-900: 15 23 42 !important;
      --heroui-primary: 15 23 42 !important;
      --heroui-primary-foreground: 255 255 255 !important;
    }
    .trainer-app [data-color="primary"],
    .trainer-app .bg-primary,
    .trainer-app button[data-color="primary"],
    .trainer-app [class*="primary"] {
      --tw-bg-opacity: 1 !important;
      background-color: rgb(15 23 42 / var(--tw-bg-opacity)) !important;
      color: white !important;
    }
    .trainer-app button[data-color="primary"]:hover {
      background-color: rgb(30 41 59) !important;
    }
    .trainer-app .heroui-button[data-color="primary"] {
      background: rgb(15 23 42) !important;
      color: white !important;
    }
    .trainer-app .heroui-button[data-color="primary"]:hover {
      background: rgb(30 41 59) !important;
    }
    .trainer-app [data-color="primary"] circle {
      stroke: rgb(15 23 42) !important;
    }
    .trainer-app .heroui-chip[data-color="primary"] {
      background: rgb(15 23 42) !important;
      color: white !important;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: trainerThemeCss }} />
      <div className="trainer-app">{children}</div>
    </>
  );
}
