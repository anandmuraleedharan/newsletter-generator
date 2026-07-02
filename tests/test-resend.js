const { Resend } = require("resend");
const fs = require("fs");

let apiKey = "";
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf-8");
  const match = envContent.match(/RESEND_API_KEY\s*=\s*(.*)/);
  if (match) {
    apiKey = match[1].trim();
  }
}

if (!apiKey) {
  console.error("RESEND_API_KEY not found in .env.local");
  process.exit(1);
}

const resend = new Resend(apiKey);

async function sendTest() {
  console.log("Sending test email using custom domain from 'newsletter@anandmuraleedharan.com'...");
  try {
    const response = await resend.emails.send({
      from: 'Anand <newsletter@anandmuraleedharan.com>',
      to: 'anand.muraleedharan@gmail.com',
      subject: 'Resend Domain Test',
      html: '<p>Testing custom domain sending before verification.</p>'
    });
    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }

  console.log("\n----------------------------------------");
  console.log("Sending test email using default 'onboarding@resend.dev'...");
  try {
    const response = await resend.emails.send({
      from: 'Anand <onboarding@resend.dev>',
      to: 'anand.muraleedharan@gmail.com',
      subject: 'Resend Onboarding Test',
      html: '<p>Testing default onboarding sending.</p>'
    });
    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

sendTest();
