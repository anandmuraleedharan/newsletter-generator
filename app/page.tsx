import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import TestExecutionButton from "@/components/TestExecutionButton";

interface Recipient {
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface RecipientsConfig {
  recipients: Recipient[];
}

function getRecipients(): Recipient[] {
  try {
    const configPath = path.join(process.cwd(), "config", "recipients.yml");
    if (!fs.existsSync(configPath)) {
      return [];
    }
    const fileContents = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(fileContents) as RecipientsConfig;
    return config.recipients || [];
  } catch (error) {
    console.error("Error reading recipients config:", error);
    return [];
  }
}

export default function Home() {
  const recipients = getRecipients();

  return (
    <main className="min-height-100vh flex flex-col justify-between py-12 px-6 sm:px-12 lg:px-24">
      {/* Top Banner Navigation */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center font-bold text-white shadow-lg shadow-accent-glow">
            CR
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">The Coffee Read</h1>
            <p className="text-xs text-gray-500 font-mono">APP V1.0</p>
          </div>
        </div>
        <a
          href="https://anandmuraleedharan.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-400 hover:text-foreground transition flex items-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back to Portfolio
        </a>
      </div>

      {/* Main Grid Layout */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-16">
        
        {/* Left Columns - Configuration details */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Header Introduction */}
          <div>
            <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium bg-accent/10 text-blue-400 border border-accent/20 mb-4">
              Serverless Micro-App
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Daily AI News Digest
            </h2>
            <p className="mt-3 text-lg text-gray-400 max-w-xl">
              An automated, zero-infrastructure engine that leverages Google Gemini's Search Grounding to research, synthesize, and email a daily morning digest of key AI breakthroughs to your inbox.
            </p>
          </div>

          {/* Recipients Config Table / Cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-200">Configured Recipients</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipients.length > 0 ? (
                recipients.map((recipient, i) => (
                  <div
                    key={i}
                    className={`p-5 rounded-xl border transition flex flex-col justify-between ${
                      recipient.active
                        ? "bg-card-bg border-card-border shadow-md"
                        : "bg-card-bg/40 border-card-border/50 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-foreground text-base">
                          {recipient.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                            recipient.active
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50"
                              : "bg-gray-950/40 text-gray-500 border-gray-900/50"
                          }`}
                        >
                          {recipient.active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-gray-500 mb-2 truncate">
                        {recipient.email}
                      </p>
                      <p className="text-sm text-gray-400 line-clamp-3">
                        <strong className="text-gray-300 font-medium">Role:</strong> {recipient.role}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-6 rounded-xl border border-dashed border-card-border text-center text-gray-500 text-sm">
                  No recipients found in config/recipients.yml
                </div>
              )}
            </div>
          </div>

          {/* Automation & Topic Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h4 className="font-semibold text-gray-300 mb-2 text-sm uppercase tracking-wider">
                Automation Schedule
              </h4>
              <p className="text-2xl font-bold text-foreground mb-1">Daily</p>
              <p className="text-sm text-gray-400">
                Every morning at 6:00 AM Central (11:00 UTC) triggered via GitHub Actions native scheduler.
              </p>
            </div>
            
            <div className="bg-card-bg border border-card-border rounded-xl p-5">
              <h4 className="font-semibold text-gray-300 mb-2 text-sm uppercase tracking-wider">
                Research Focus Topic
              </h4>
              <p className="text-base font-semibold text-foreground mb-1">Daily AI News & Breakthroughs</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                A daily "morning read" summarizing the top 3-5 AI news events, model releases, research findings, and industry updates from the last 24 hours.
              </p>
            </div>
          </div>

        </div>

        {/* Right Column - Trigger Execution form */}
        <div className="lg:col-span-1">
          <TestExecutionButton />
        </div>

      </div>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto border-t border-card-border pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-4">
        <div>
          &copy; 2026 Anand Muraleedharan. All rights reserved.
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Serverless Vercel Hub
          </span>
          <span>&middot;</span>
          <span>Powered by Gemini & Resend</span>
        </div>
      </footer>
    </main>
  );
}
