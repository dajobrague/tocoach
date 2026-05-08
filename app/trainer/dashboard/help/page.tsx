"use client";

import { useEffect, useState } from "react";

import AyudaContent from "@/components/dashboard/ayuda-content";

interface SessionInfo {
  email: string;
  full_name?: string;
}

export default function HelpPage() {
  const [info, setInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.session) {
          setInfo({
            email: data.session.email,
            full_name: data.session.full_name,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!info) return null;

  return (
    <AyudaContent
      trainerEmail={info.email}
      trainerName={info.full_name || info.email}
    />
  );
}
