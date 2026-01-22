"use client";

import { useEffect, useState } from "react";

export default function IframeDiagnosticPage() {
  const [diagnostics, setDiagnostics] = useState({
    isInIframe: false,
    parentOrigin: "unknown",
    protocol: "",
    cookiesEnabled: false,
    localStorageEnabled: false,
    userAgent: "",
    screenSize: "",
    referrer: "",
    currentUrl: "",
  });

  useEffect(() => {
    // Check if we're in an iframe
    const isInIframe = window.self !== window.top;

    // Get parent origin safely
    let parentOrigin = "Not in iframe";

    try {
      if (isInIframe && window.parent) {
        parentOrigin = document.referrer || "Cannot access parent origin";
      }
    } catch (e) {
      parentOrigin = "Cross-origin (cannot access)";
    }

    // Test cookies
    let cookiesEnabled = false;

    try {
      document.cookie = "test=1; SameSite=None; Secure";
      cookiesEnabled = document.cookie.indexOf("test=1") !== -1;
      document.cookie = "test=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    } catch (e) {
      cookiesEnabled = false;
    }

    // Test localStorage
    let localStorageEnabled = false;

    try {
      localStorage.setItem("test", "1");
      localStorageEnabled = localStorage.getItem("test") === "1";
      localStorage.removeItem("test");
    } catch (e) {
      localStorageEnabled = false;
    }

    setDiagnostics({
      isInIframe,
      parentOrigin,
      protocol: window.location.protocol,
      cookiesEnabled,
      localStorageEnabled,
      userAgent: navigator.userAgent,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      referrer: document.referrer || "None",
      currentUrl: window.location.href,
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">
            🔍 Iframe Embedding Diagnostic Tool
          </h1>

          <div className="space-y-4">
            <DiagnosticRow
              label="Running in iframe?"
              status={diagnostics.isInIframe ? "success" : "info"}
              value={diagnostics.isInIframe ? "✅ Yes" : "❌ No"}
            />

            <DiagnosticRow
              label="Parent Origin"
              status="info"
              value={diagnostics.parentOrigin}
            />

            <DiagnosticRow
              label="Protocol"
              status={diagnostics.protocol === "https:" ? "success" : "warning"}
              value={diagnostics.protocol}
              {...(diagnostics.protocol !== "https:" && {
                note: "⚠️ HTTPS required for cross-origin cookies",
              })}
            />

            <DiagnosticRow
              label="Cookies Enabled"
              status={diagnostics.cookiesEnabled ? "success" : "error"}
              value={diagnostics.cookiesEnabled ? "✅ Yes" : "❌ No"}
              {...(!diagnostics.cookiesEnabled && {
                note: "⚠️ Cookies are blocked - authentication will not work",
              })}
            />

            <DiagnosticRow
              label="LocalStorage Enabled"
              status={diagnostics.localStorageEnabled ? "success" : "warning"}
              value={diagnostics.localStorageEnabled ? "✅ Yes" : "❌ No"}
            />

            <DiagnosticRow
              label="Current URL"
              status="info"
              value={diagnostics.currentUrl}
            />

            <DiagnosticRow
              label="Referrer"
              status="info"
              value={diagnostics.referrer}
            />

            <DiagnosticRow
              label="Screen Size"
              status="info"
              value={diagnostics.screenSize}
            />

            <div className="mt-6 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">User Agent:</h3>
              <p className="text-sm text-gray-600 break-all">
                {diagnostics.userAgent}
              </p>
            </div>
          </div>

          {diagnostics.isInIframe && !diagnostics.cookiesEnabled && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <h3 className="font-bold text-red-800 mb-2">
                ⚠️ Cookie Issue Detected
              </h3>
              <p className="text-red-700">
                Cookies are blocked in this iframe context. This means:
              </p>
              <ul className="list-disc ml-5 mt-2 text-red-700">
                <li>User authentication will not work</li>
                <li>Sessions will not persist</li>
                <li>Login will fail</li>
              </ul>
              <p className="mt-3 text-red-700 font-semibold">
                Possible causes:
              </p>
              <ul className="list-disc ml-5 text-red-700">
                <li>Not using HTTPS (required for SameSite=None cookies)</li>
                <li>Browser privacy settings blocking third-party cookies</li>
                <li>Missing Secure flag on cookies</li>
              </ul>
            </div>
          )}

          {diagnostics.protocol !== "https:" && (
            <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <h3 className="font-bold text-yellow-800 mb-2">
                ⚠️ HTTPS Required
              </h3>
              <p className="text-yellow-700">
                This page is loaded over HTTP. For iframe embedding to work with
                authentication (cookies), you must use HTTPS in production.
              </p>
            </div>
          )}

          {diagnostics.isInIframe && diagnostics.cookiesEnabled && (
            <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
              <h3 className="font-bold text-green-800 mb-2">
                ✅ Configuration Looks Good!
              </h3>
              <p className="text-green-700">
                Your app is running in an iframe with cookies enabled. This is
                the correct setup for Go High Level embedding.
              </p>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded">
            <h3 className="font-semibold text-blue-800 mb-2">
              Next Steps for Testing:
            </h3>
            <ol className="list-decimal ml-5 text-blue-700 space-y-1">
              <li>If seeing this in GHL: Check if cookies are enabled above</li>
              <li>Ensure production URL uses HTTPS</li>
              <li>Test authentication flow</li>
              <li>Check browser console for errors</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiagnosticRow({
  label,
  value,
  status,
  note,
}: {
  label: string;
  value: string;
  status: "success" | "error" | "warning" | "info";
  note?: string;
}) {
  const statusColors = {
    success: "bg-green-50 border-green-200",
    error: "bg-red-50 border-red-200",
    warning: "bg-yellow-50 border-yellow-200",
    info: "bg-blue-50 border-blue-200",
  };

  return (
    <div className={`p-3 border rounded ${statusColors[status]}`}>
      <div className="flex justify-between items-start">
        <span className="font-semibold text-gray-700">{label}:</span>
        <span className="text-gray-900 ml-4 text-right break-all">{value}</span>
      </div>
      {note && <p className="text-sm mt-1 text-gray-600 italic">{note}</p>}
    </div>
  );
}
