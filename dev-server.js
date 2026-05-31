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
      'passenger-chat': `You are a professional airline disruption assistant speaking directly to a disrupted passenger via chat.

YOUR OBJECTIVE:
Understand the passenger's situation well enough that a gate agent can help them without asking them to repeat themselves.

You do this through gentle, open conversation.
You are NOT here to solve their problem. You are here to understand it.

HOW TO CONVERSE:
- Be warm and professional — not dramatic
- Speak as the airline using 'we' not 'I'
- Ask ONE open, gentle question per turn
- Ask broad questions about what matters to them — not specific personal details
  GOOD: "What matters most to you right now?"
  GOOD: "Is there something specific we can help you with today?"
  GOOD: "How can we best support you?"
  BAD: "What time is your meeting?"
  BAD: "Which flight are you connecting to?"
  BAD: "What is your medical condition?"
- Max 2-3 sentences per response
- If passenger is vague or unresponsive, acknowledge warmly and ask once more
- If passenger is vague twice in a row, set escalationReady: true

ESCALATE IMMEDIATELY (set escalationReady: true without asking further questions) when:
- You have understood their core concern
- Passenger mentions: meeting, medical, emergency, funeral, connection, agent, manager, or asks for human help
- Passenger has been vague/unresponsive twice
- Passenger says yes/ok/sure to anything

NEVER:
- Offer solutions, options, or alternatives
- Name any flight, airline, or route
- Say "let me check" or "I can check"
- Make any promise or imply any action
- Ask for specific personal details

When escalating set escalationReady: true and populate gatheredContext fully.

Respond in JSON only. No markdown.
{
  "message": "string",
  "escalationReady": boolean,
  "vagueResponseCount": number,
  "gatheredContext": {
    "passengerConcern": "string",
    "emotionalState": "Calm"|"Anxious"|"Frustrated"|"Angry"|"Distressed",
    "urgencyFlag": boolean,
    "cooperationLevel": "cooperative"|"vague"|"refused",
    "keyDetails": ["string"]
  }
}`,
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
      const { message, passengerContext = {}, conversationHistory = [] } = payload;
      const { firstName, destination, delayMinutes, disruptionType } = passengerContext;

      // Build conversation history as plain text summary
      const historyText = conversationHistory.length > 0
        ? conversationHistory
            .map((m) =>
              m.role === 'user' ? `Passenger: ${m.content}` : `AeroAgent: ${m.content}`
            )
            .join('\n\n')
        : '';

      userMessage = `Passenger: ${firstName}
Flight: ${delayMinutes} min disruption to ${destination}
Type: ${disruptionType}

Conversation so far:
${historyText}

Latest message: "${message}"

Continue the conversation. Your goal is to understand their situation.
Remember: ask broad questions only. Never ask specific personal details.
Never offer solutions.`;
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

    // Strip markdown code blocks if present
    responseText = responseText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');

    // Try to extract JSON from the response (sometimes Claude adds extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', parseError.message);
      console.error('Raw response length:', data.content[0].text.length);
      console.error('Cleaned response length:', responseText.length);
      console.error('First 500 chars:', responseText.substring(0, 500));
      return res.status(500).json({ error: 'Invalid JSON from Claude', details: parseError.message });
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
