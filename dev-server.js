import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

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
      'gate-agent': `You are an AI recovery advisor for airline gate agents handling disrupted passengers. You have deep knowledge of EU261/2004 and US DOT regulations. You reason across passenger tier, cabin class, SSR codes, delay duration, disruption cause, jurisdiction, and financial exposure to recommend the best recovery action.

Do not just apply rules. Exercise judgment. Consider vulnerability, time pressure, legal obligations, and the airline's financial exposure simultaneously.

Respond ONLY in valid JSON with this exact structure:
{
  "recommendedAction": "rebook_same_metal" | "rebook_partner" | "rebook_interline" | "hotel_and_meals" | "meal_voucher" | "lounge_access" | "compensation" | "notification_only" | "escalate",
  "details": "one sentence describing the specific action to take",
  "justification": "2-3 sentences in plain English the gate agent reads in 5 seconds and uses to explain the decision to the passenger face to face",
  "distressLevel": "Critical" | "High" | "Medium" | "Low",
  "distressReason": "one sentence explaining the primary distress driver",
  "estimatedLiability": number,
  "currency": "EUR" | "USD" | "AED",
  "regulatoryBasis": "EU261" | "USDOT" | "Goodwill" | "None",
  "regulatoryNote": "one sentence on the specific regulatory obligation in this case",
  "priorityScore": number between 0 and 100
}`,
    };

    const systemPrompt = systemPrompts[useCase] || systemPrompts['gate-agent'];
    const userMessage = `Passenger: ${JSON.stringify(payload.passenger, null, 2)}\n\nAnalysis Context: ${JSON.stringify(payload.analysis || {}, null, 2)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
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

    const responseText = data.content[0].text;
    const parsedResponse = JSON.parse(responseText);

    console.log(`[${new Date().toISOString()}] Claude API success | useCase: ${useCase} | PNR: ${payload.passenger?.pnr}`);

    return res.json({
      success: true,
      useCase,
      data: parsedResponse
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Claude API unavailable',
      details: error.message
    });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
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
