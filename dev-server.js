/*
 * SYNC REQUIRED — must match api/claude.ts
 * - PASSENGER_CHAT_SYSTEM_PROMPT (simple version)
 * - buildUserMessage (passenger-chat Task A/B branch)
 * - passenger-chat model: claude-haiku-4-5-20251001
 * - passenger-chat max_tokens: 450
 * - plain text response parsing (not JSON)
 * Last verified in sync: 2026-05-31
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Fallback: explicitly read .env.local if dotenv.config didn't work
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const fs = await import('fs');
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
    if (match) {
      process.env.ANTHROPIC_API_KEY = match[1].trim();
    }
  } catch (error) {
    // Silently fail - API key might be set elsewhere
  }
}

console.log('[Dev Server] Loaded API Key:', process.env.ANTHROPIC_API_KEY ? 'YES (set)' : 'NO (missing)');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Create Vite server in middleware mode
let vite;
const startViteServer = async () => {
  vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
};

// Note: API routes defined BEFORE vite.middlewares to ensure they take precedence

// API endpoint for Claude
app.post('/api/claude', async (req, res) => {
  try {
    const { useCase, payload } = req.body;

    if (!useCase || !payload) {
      return res.status(400).json({ error: 'Missing useCase or payload' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set in .env.local');
      return res.status(500).json({ error: 'Claude API unavailable' });
    }

    console.log(`[${new Date().toISOString()}] Claude API call | useCase: ${useCase} | PNR: ${payload.passenger?.pnr}`);

    // Call Anthropic API
    const systemPrompts = {
      'gate-agent': `You are an AI recovery advisor for airline gate agents. Return ONLY valid JSON, no markdown, no code blocks, no explanation. Use this exact format:
{
  "recommendedAction": "string describing the recommended action",
  "details": "string with detailed explanation",
  "justification": "string explaining the reasoning",
  "distressLevel": "one of: Critical, High, Medium, Low",
  "distressReason": "string explaining distress factors",
  "regulatoryBasis": "one of: EU261, USDOT, APPR, Goodwill, None",
  "regulatoryNote": "string with regulatory details",
  "priorityScore": 30,
  "flaggedIssues": ["issue1", "issue2"],
  "agentTalkingPoints": ["point1", "point2"],
  "recoveryOptions": ["option1", "option2"]
}`,
      'passenger-chat': `You are a warm, empathetic airline assistant. You speak as the airline in first person plural (we, us, our). You are given a task. Follow it precisely. Respond with ONLY the message text. No JSON. No explanation. Just the message.`,
      'whatsapp-message': `Generate a WhatsApp message. Return ONLY valid JSON, no markdown, no code blocks, no explanation:
{
  "message": "string - personalized WhatsApp message for passenger",
  "messageType": "INFORMATIONAL or ACTIONABLE or ESCALATION",
  "tone": "neutral or apologetic or empathetic or urgent",
  "includedElements": ["flight_info"],
  "qrCodeRequired": false,
  "qrCodeType": null
}`,
      'escalation-handoff': `Prepare handoff briefing. Return ONLY valid JSON, no markdown, no code blocks, no explanation:
{
  "summary": "string with concise summary",
  "passengerConcern": "string describing main concern",
  "emotionalState": "one of: Frustrated, Anxious, Angry, Distressed, Calm, Resigned",
  "urgencyLevel": "one of: Critical, High, Medium, Low",
  "whatWasArranged": ["action1", "action2"],
  "suggestedOpeningLine": "string for agent to use",
  "sensitiveIssues": ["issue1"],
  "recommendedAction": "string",
  "estimatedResolutionTime": "string like '10 mins'"
}`,
      'cfo-audit': `Generate audit narrative. Return ONLY valid JSON, no markdown, no code blocks, no explanation:
{
  "narrative": "string with audit findings",
  "regulationCited": "string like EU261",
  "liabilityBreakdown": "string with cost analysis",
  "exceptionFlag": false,
  "exceptionNote": null
}`
    };

    const systemPrompt = systemPrompts[useCase] || systemPrompts['gate-agent'];
    let userMessage;
    if (useCase === 'passenger-chat') {
      const { message, task, passengerContext = {} } = payload;
      const { firstName, destination, delayMinutes } = passengerContext;

      if (task === 'A') {
        // Task A: Write escalation closing message
        userMessage = `Passenger name: ${firstName}
Their message: "${message}"

Write ONE warm, empathetic message that:
1. Acknowledges what they said in one sentence
2. Tells them a gate agent is on their way and has everything they need
3. Asks them to stay on the chat

Use "we" not "I". Max 3 sentences.
Do not ask any questions. Do not offer options.
Do not mention flights or airlines.`;
      } else {
        // Task B: Write first exchange message with one gentle question
        userMessage = `Passenger name: ${firstName}
Their message: "${message}"
Flight disruption: ${delayMinutes} min delay to ${destination}

Write ONE warm, empathetic message that:
1. Acknowledges their frustration or concern
2. Asks ONE gentle question to understand what matters most to them right now

Use "we" not "I". Max 2 sentences.
Do not offer options or alternatives.
Do not mention flights or airlines.
Do not say "let me check" or "I can check".`;
      }
    } else {
      userMessage = `Passenger: ${JSON.stringify(payload.passenger || {}, null, 2)}\n\nContext: ${JSON.stringify(payload, null, 2)}`;
    }

    const anthropicMessages = [{ role: 'user', content: userMessage }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: useCase === 'passenger-chat' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
        max_tokens: useCase === 'passenger-chat' ? 450 : 512,
        system: systemPrompt,
        messages: anthropicMessages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', response.status, error);
      return res.status(500).json({ error: 'Claude API unavailable' });
    }

    const data = await response.json();
    if (!data.content || !data.content[0] || data.content[0].type !== 'text') {
      console.error('Unexpected Claude response:', data);
      return res.status(500).json({ error: 'Invalid response from Claude' });
    }

    let responseText = data.content[0].text;
    console.log(`[${new Date().toISOString()}] Raw response length: ${responseText.length} bytes`);

    // Trim whitespace
    responseText = responseText.trim();

    let parsedResponse;
    if (useCase === 'passenger-chat') {
      // passenger-chat returns plain text message, no JSON parsing
      console.log(`[Dev Server] passenger-chat: plain text response`);
      parsedResponse = {
        message: responseText
      };
    } else {
      // All other useCases return JSON
      // Strip markdown code blocks if present
      responseText = responseText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');

      // Try to extract JSON from the response (sometimes Claude adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseText = jsonMatch[0];
      }

      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', parseError.message);
        console.error('Raw response length:', data.content[0].text.length);
        console.error('Cleaned response length:', responseText.length);
        console.error('First 500 chars:', responseText.substring(0, 500));
        return res.status(500).json({ error: 'Invalid JSON from Claude', details: parseError.message });
      }
    }

    console.log(`[${new Date().toISOString()}] Claude API success | useCase: ${useCase} | PNR: ${payload.passenger?.pnr}`);

    return res.json({
      success: true,
      useCase,
      data: parsedResponse
    });

  } catch (error) {
    console.error('API Error:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Claude API unavailable',
      details: error.message
    });
  }
});

// SPA fallback - serve index.html ONLY for actual page navigation
app.use((req, res, next) => {
  // Don't rewrite: Vite routes, files with extensions, API routes
  if (req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/@') &&
      !req.path.includes('.') &&
      req.path !== '/') {
    req.url = '/index.html';
  }
  next();
});

const PORT = process.env.PORT || 3000;

(async () => {
  await startViteServer();

  // Add Vite middleware LAST, after all API routes
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Dev server running at http://localhost:${PORT}/`);
    console.log(`✓ Vite + Express ready for development\n`);
  });
})();
