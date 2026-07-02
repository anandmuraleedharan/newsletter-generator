import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';

// Define TS Interfaces for recipient configs
interface Recipient {
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface RecipientsConfig {
  recipients: Recipient[];
}

// Simple regex-based Markdown to HTML converter to avoid bloated dependencies
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Convert code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background: #0f172a; padding: 15px; border-radius: 6px; border: 1px solid #1e293b; font-family: monospace; overflow-x: auto; margin-bottom: 20px; font-size: 13px; color: #94a3b8;"><code>$1</code></pre>');

  // Convert headers (###, ##, #)
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #ffffff; font-size: 16px; font-weight: 700; margin-top: 24px; margin-bottom: 8px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #3b82f6; font-size: 19px; font-weight: 800; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 6px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin-top: 36px; margin-bottom: 16px;">$1</h1>');

  // Convert bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 700;">$1</strong>');

  // Convert links ([text](url))
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: 500;">$1</a>');

  // Convert list items (- item or * item)
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-bottom: 8px; color: #cbd5e1; line-height: 1.6; font-size: 15px;">$1</li>');

  // Wrap list items in <ul>
  const lines = html.split('\n');
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('<li')) {
      if (!inList) {
        lines[i] = '<ul style="padding-left: 20px; margin-top: 0; margin-bottom: 18px; list-style-type: disc; color: #3b82f6;">' + lines[i];
        inList = true;
      }
    } else {
      if (inList) {
        lines[i - 1] = lines[i - 1] + '</ul>';
        inList = false;
      }
    }
  }
  if (inList) {
    lines[lines.length - 1] = lines[lines.length - 1] + '</ul>';
  }
  html = lines.join('\n');

  // Convert double newlines to paragraphs (excluding lists/headers/pre blocks)
  html = html.split(/\n\s*\n/).map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<pre') || trimmed.startsWith('<div')) {
      return trimmed;
    }
    return `<p style="line-height: 1.6; color: #cbd5e1; margin-top: 0; margin-bottom: 16px; font-size: 15px;">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

function getMockNewsletter(recipientName: string, recipientRole: string): string {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `# The Daily Read: AI News Digest (Mock)

Hello ${recipientName},

Welcome to your morning read for **${dateStr}**. Here is a curated digest of the top 3-5 most critical AI news stories, model releases, and breakthroughs from the last 24 hours to keep you ahead of the curve in your role as an **${recipientRole}**.

## 1. Google Launches Gemini 3.0 Pro with 2M Token Context
Google has officially unveiled its next-generation Gemini 3.0 Pro model. The model features a native 2-million token context window, significantly improved reasoning capabilities, and a 40% reduction in API latency.
* **Why it matters:** This model enables developers to process entire repositories or hours of audio/video natively in a single prompt, paving the way for advanced agentic workflows.
* **Details:** The update is rolling out immediately to Google AI Studio and Vertex AI developer accounts.

## 2. Meta Releases Llama 4 Open-Weights Frontier Models
Meta has shocked the open-source community by releasing Llama 4-70B. In zero-shot coding and mathematics evaluations, Llama 4 matches or exceeds the performance of closed frontier models.
* **Why it matters:** It shifts the baseline for what can be run locally or self-hosted in enterprise environments, driving down proprietary API costs.
* **Details:** Weights are available on Hugging Face, with optimized inference configurations ready for vLLM and Ollama.

## 3. OpenAI Introduces Advanced Voice API for Web Apps
OpenAI has opened access to its real-time multimodal audio engine. Developers can now build web interfaces that support natural, conversational voice interactions with less than 200ms latency.
* **Why it matters:** This enables the next generation of voice-guided customer support, real-time speech translation, and interactive educational tutors.
* **Details:** The WebSocket API is now live for all Tier 1 developer accounts.

---

### Sources & References
* **[Google Developer Blog: Introducing Gemini 3.0](https://developers.googleblog.com/)**
* **[Meta AI Research: Llama 4 Open Weights Release](https://ai.meta.com/blog/)**
* **[OpenAI API Docs: Realtime Audio Engine](https://platform.openai.com/docs/)**

Best,
Your Daily AI Assistant`;
}

async function fetchSearchContext(query: string): Promise<string> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const snippets: string[] = [];
    const snippetRegex = /<a class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      const cleanSnippet = match[1].replace(/<[^>]*>/g, "").trim();
      snippets.push(cleanSnippet);
    }

    return snippets.join("\n\n");
  } catch (e) {
    return "";
  }
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateContentWithFallback(
  ai: any,
  systemInstruction: string,
  contents: string,
  logs: string[],
  openrouterKey?: string
): Promise<string> {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];

  if (ai) {
    for (const model of models) {
      let attempts = 3;
      let waitTime = 2000; // start with 2 seconds

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          logs.push(`Attempting generation with ${model} (Attempt ${attempt}/${attempts})...`);
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }] // Enabled native Google Search Grounding
            }
          });

          if (response.text) {
            logs.push(`Successfully generated content using ${model}.`);
            return response.text;
          }
        } catch (err: any) {
          const isQuotaExceededMessage = err.message?.includes('billing') || 
                                        err.message?.includes('check your plan') ||
                                        err.message?.includes('exceeded your current quota');

          const isTemporary = (err.message?.includes('503') || 
                              err.message?.includes('429') || 
                              err.message?.includes('temporary') || 
                              err.message?.includes('high demand') ||
                              err.status === 'UNAVAILABLE' ||
                              err.status === 'RESOURCE_EXHAUSTED' ||
                              err.message?.includes('RESOURCE_EXHAUSTED')) && 
                              !isQuotaExceededMessage;
                              
          if (isTemporary && attempt < attempts) {
            logs.push(`Warning: ${model} returned temporary error: ${err.message}. Retrying in ${waitTime / 1000}s...`);
            await delay(waitTime);
            waitTime *= 2; // exponential backoff
          } else {
            logs.push(`Failed with ${model} on attempt ${attempt}: ${err.message}`);
            break; // Move to the next model in the chain
          }
        }
      }
    }
  }

  // OpenRouter Fallback
  if (openrouterKey) {
    try {
      logs.push("Gemini options exhausted or bypassed. Initiating free search grounding...");
      const searchContext = await fetchSearchContext("breaking AI news model releases research breakthroughs last 24 hours 2026");
      
      let finalContents = contents;
      if (searchContext) {
        logs.push("Free search grounding context gathered successfully from DuckDuckGo.");
        finalContents = `${contents}\n\nHere is some live, real-world context gathered from the web regarding this topic. Use these specific examples, statistics, and findings to write your newsletter:\n\n${searchContext}`;
      } else {
        logs.push("Warning: Free search grounding context was empty.");
      }

      const orModels = [
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemma-4-31b-it:free',
        'openai/gpt-oss-120b:free',
        'openrouter/free'
      ];

      for (const orModel of orModels) {
        try {
          logs.push(`Attempting fallback generation with OpenRouter model: ${orModel}...`);
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openrouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://anandmuraleedharan.com",
              "X-Title": "The Coffee Read",
            },
            body: JSON.stringify({
              model: orModel,
              messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: finalContents }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;
            if (text) {
              logs.push(`Successfully generated content using OpenRouter model: ${orModel}.`);
              return text;
            }
          } else {
            const errBody = await response.json().catch(() => ({}));
            logs.push(`Model ${orModel} failed: ${errBody.error?.message || response.statusText}`);
          }
        } catch (err: any) {
          logs.push(`Error calling ${orModel}: ${err.message}`);
        }
      }
    } catch (err: any) {
      logs.push(`Failed with OpenRouter free model fallback chain: ${err.message}`);
    }
  }

  throw new Error("All models in the fallback chain failed to generate content due to high demand, quota limits, or network errors.");
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  try {
    // 1. Authorization Guard
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for mock flag
    let mock = false;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        mock = body.mock === true;
      }
    } catch (e) {
      // Body is empty or not JSON, ignore
    }

    // 2. Load YAML Config
    const configPath = path.join(process.cwd(), 'config', 'recipients.yml');
    if (!fs.existsSync(configPath)) {
      return NextResponse.json({ error: 'Recipients configuration file not found.' }, { status: 500 });
    }

    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as RecipientsConfig;

    const activeRecipients = config.recipients.filter(r => r.active);
    if (activeRecipients.length === 0) {
      return NextResponse.json({ message: 'No active recipients found. Execution skipped.' }, { status: 200 });
    }

    // 3. Initialize Clients
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY environment variable is missing.' }, { status: 500 });
    }
    const resend = new Resend(process.env.RESEND_API_KEY);

    let ai: any = null;
    if (!mock) {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY environment variable is missing.' }, { status: 500 });
      }
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    // logs variable declared at POST function start

    // 4. Run Newsletter Generation & Delivery Pipeline for each active recipient
    for (const recipient of activeRecipients) {
      logs.push(`Processing recipient: ${recipient.name} (${recipient.email})`);

      let responseText = "";
      if (mock) {
        logs.push("Mock LLM Mode active. Generating pre-written draft to bypass APIs.");
        responseText = getMockNewsletter(recipient.name, recipient.role);
      } else {
        // Construct LLM execution
        const systemInstruction = `You are an elite AI research assistant. Conduct a live web search for the most significant AI news, model launches, product releases, and research breakthroughs that occurred in the last 24 hours. Synthesize your findings into a daily "morning read" digest consisting of 3 to 5 main stories. For each story, provide a concise explanation of what occurred, why it matters, and any key implications for technology professionals like ${recipient.name}, who is an ${recipient.role}. Maintain a highly professional, sharp, yet readable tone. Use crisp markdown formatting with clean headings, bold text, and bullet points. Include live web citations and links at the bottom. Sign off with: 'Best,\nYour Daily AI Assistant'. Do not use bracketed placeholders.`;

        const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        responseText = await generateContentWithFallback(
          ai,
          systemInstruction,
          `Generate today's AI news digest for ${dateStr}.`,
          logs,
          process.env.OPENROUTER_API_KEY
        );
      }

      // Convert generated content markdown to clean HTML
      const contentHtml = markdownToHtml(responseText);


      // Wrap in a premium email layout template
      const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>The Daily Read: AI News Digest</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; padding: 30px 15px; margin: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3);">
          
          <!-- Top Accent Neon Bar -->
          <div style="height: 4px; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);"></div>
          
          <!-- Header Banner -->
          <div style="background-color: #0d1527; padding: 36px 30px; text-align: center; border-bottom: 1px solid #1e293b;">
            <span style="font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6; font-weight: 700; background: rgba(59, 130, 246, 0.1); padding: 4px 10px; border-radius: 99px;">
              Premium AI Digest
            </span>
            <h1 style="margin: 16px 0 6px 0; font-size: 26px; font-weight: 900; letter-spacing: -0.03em; color: #ffffff;">
              The Daily Read
            </h1>
            <p style="margin: 0; font-size: 14px; color: #94a3b8; font-weight: 400;">
              AI News Digest for <strong style="color: #ffffff; font-weight: 600;">${recipient.name}</strong>
            </p>
          </div>
          
          <!-- Body Content -->
          <div style="padding: 36px 30px; background-color: #0b0f19; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
            ${contentHtml}
          </div>
          
          <!-- Footer -->
          <div style="background-color: #0d1527; padding: 28px 30px; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
            <p style="margin: 0 0 12px 0; line-height: 1.6;">
              This digest was dynamically researched via Google Search and synthesized using Gemini generative AI.
            </p>
            <p style="margin: 0 0 20px 0;">
              &copy; 2026 Anand Muraleedharan. All rights reserved.
            </p>
            <div style="margin-top: 16px;">
              <a href="https://anandmuraleedharan.com" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #1e293b; color: #ffffff; font-weight: 600; font-size: 12px; text-decoration: none; border-radius: 6px; border: 1px solid #334155;">
                ← Back to Anand's Portfolio
              </a>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      // Trigger Resend email delivery
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Anand <onboarding@resend.dev>';
      logs.push(`Sending email via Resend from ${fromEmail} to ${recipient.email}...`);

      const emailResponse = await resend.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject: `The Daily Read: AI News Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        html: emailHtml,
      });

      if (emailResponse.error) {
        throw new Error(`Resend API Error: ${emailResponse.error.message} (Status Code: ${emailResponse.error.statusCode})`);
      }

      logs.push(`Email successfully sent via Resend for ${recipient.name}. Message ID: ${emailResponse.data?.id}`);
    }

    return NextResponse.json({ success: true, logs }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 });
  }
}
