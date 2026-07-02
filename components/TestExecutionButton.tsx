"use client";

import React, { useState, useEffect, useRef } from "react";

export default function TestExecutionButton() {
  const [cronSecret, setCronSecret] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const consoleRef = useRef<HTMLDivElement>(null);

  // Load saved secret and mock preference from localStorage on mount
  useEffect(() => {
    const savedSecret = localStorage.getItem("newsletter_cron_secret");
    if (savedSecret) {
      setCronSecret(savedSecret);
    }
    const savedMockMode = localStorage.getItem("newsletter_mock_mode");
    if (savedMockMode === "true") {
      setMockMode(true);
    }
  }, []);

  // Auto-scroll logs console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const triggerExecution = async () => {
    if (!cronSecret.trim()) {
      setError("Please enter the CRON_SECRET token.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setLogs([]);

    // Save secret and mock mode preference to localStorage for convenience
    localStorage.setItem("newsletter_cron_secret", cronSecret);
    localStorage.setItem("newsletter_mock_mode", mockMode ? "true" : "false");

    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mock: mockMode }),
      });

      const data = await res.json();
      
      if (data.logs) {
        setLogs(data.logs);
      }

      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-6 shadow-xl">
      <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse"></span>
        Execute Trigger Test
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Cron Secret Authorization Token (Bearer)
          </label>
          <input
            type="password"
            value={cronSecret}
            onChange={(e) => setCronSecret(e.target.value)}
            placeholder="Enter CRON_SECRET"
            className="w-full px-4 py-2.5 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-gray-600 transition"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            For security, this token is sent in the header to authenticate the serverless API endpoint.
          </p>
        </div>

        {/* Mock LLM Mode Toggle */}
        <div className="p-4 rounded-lg bg-card-bg/50 border border-card-border/60 flex items-center justify-between">
          <div className="flex flex-col pr-3">
            <label className="text-sm font-medium text-gray-300 cursor-pointer" htmlFor="mock-mode">
              Mock LLM Generation
            </label>
            <span className="text-[11px] text-gray-500 mt-0.5">
              Bypass LLM APIs, email a premium mock draft (Free).
            </span>
          </div>
          <input
            id="mock-mode"
            type="checkbox"
            checked={mockMode}
            onChange={(e) => setMockMode(e.target.checked)}
            className="h-4 w-4 rounded bg-background border-card-border text-accent focus:ring-accent focus:ring-offset-background cursor-pointer"
          />
        </div>


        <button
          onClick={triggerExecution}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white transition flex items-center justify-center gap-2 ${
            loading
              ? "bg-accent/50 cursor-not-allowed"
              : "bg-accent hover:bg-accent-hover active:scale-[0.98]"
          }`}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Executing Pipeline...
            </>
          ) : (
            "Trigger Test Execution"
          )}
        </button>

        {/* Feedback Messages */}
        {error && (
          <div className="bg-red-950/40 border border-red-900/50 text-red-300 px-4 py-3 rounded-lg text-sm">
            <strong className="font-semibold block">Execution Failed</strong>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 px-4 py-3 rounded-lg text-sm">
            <strong className="font-semibold block">Success!</strong>
            <p className="mt-1">Newsletter researched and sent successfully via Resend.</p>
          </div>
        )}

        {/* Logs Console */}
        {logs.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Execution Logs Console
            </label>
            <div ref={consoleRef} className="bg-black/60 border border-card-border p-4 rounded-lg font-mono text-xs text-emerald-400 space-y-1.5 max-h-72 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-gray-500">[{index + 1}]</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
