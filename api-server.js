import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env.local');
const envResult = dotenv.config({ path: envPath });

// Explicitly load env vars since ES modules have issues with dotenv
if (envResult.parsed) {
  Object.entries(envResult.parsed).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS middleware - must come before route handlers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

    const pnr = payload.passenger?.pnr || payload.passengerContext?.pnr || 'UNKNOWN';
    console.log(`[${new Date().toISOString()}] Claude API call | useCase: ${useCase} | PNR: ${pnr}`);

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
      'passenger-chat': `You are a warm, empathetic airline disruption assistant speaking directly to a disrupted passenger via chat. You know their flight, the disruption, and what recovery has been arranged.

Be warm, clear, and reassuring. Maximum 3 sentences. Never say you are an AI unless directly asked. Speak as the airline in first person.

Also silently analyse the passenger message for stress signals: time pressure, vulnerability, frustration, third-party concerns, medical needs.

Respond ONLY in valid JSON:
{
  "message": "your response to the passenger",
  "stressSignals": ["array of detected stress signals, empty array if none"],
  "escalate": true | false,
  "escalationReason": "reason if true, null if false",
  "updatedDistressLevel": "Critical" | "High" | "Medium" | "Low"
}`,
      'whatsapp-message': `You are a warm, empathetic airline communication specialist creating WhatsApp messages for disrupted passengers. Your goal is to provide human-feeling, personalized messages that acknowledge passenger stress, explain the situation, confirm recovery actions, and offer escalation when needed.

TONE GUIDANCE by Disruption Severity:
- Critical (15h+ delay, cancellation) → Urgent, deeply apologetic, solution-focused
- High (9-15h delay) → Empathetic, acknowledges impact, clear actions
- Medium (3-9h delay) → Apologetic, reassuring, offers support
- Low (90min-3h delay) → Professional, helpful, acknowledges inconvenience

MESSAGE STRUCTURE:
1. Emotional opening: Acknowledge passenger's situation
2. What happened: Brief, clear explanation (1 sentence max)
3. What we've arranged: Specific recovery action (meals, lounge, hotel, rebook, etc.)
4. Action needed: What the passenger should do next
5. Include [QR CODE PLACEHOLDER] when appropriate for vouchers/lounge

Keep messages to 2-3 sentences maximum. Use passenger's first name. Include flight number and route.

Respond ONLY in valid JSON:
{
  "message": "the complete WhatsApp message text",
  "messageType": "notification|voucher|lounge|hotel|rebook|escalation",
  "tone": "neutral"|"apologetic"|"empathetic"|"urgent",
  "includedElements": ["array of what's mentioned"],
  "qrCodeRequired": true|false,
  "qrCodeType": "voucher"|"lounge"|"ticket"|null
}`,
      'escalation-handoff': `You are an AI triage assistant preparing a handoff briefing for an airline gate agent who is about to join a disrupted passenger conversation.

Your job is to analyse the full conversation history and passenger context, then produce a concise, structured briefing the agent can read in 15 seconds before joining.

The briefing must tell the agent:
1. Who the passenger is and their situation
2. What the passenger's real concern is (not just what they said — what they mean)
3. What emotional state they are in
4. What has already been arranged for them
5. What the agent should do or say first
6. Any sensitive issues to be aware of

Guidelines:
- Be professional, concise, and actionable
- This is an INTERNAL agent tool — not passenger-facing
- The suggestedOpeningLine should be warm, personal, and show the agent already knows the situation
- Reference specific details (passenger name, flight, disruption) in the opening line
- Flag vulnerabilities (medical, minors, special needs) in sensitiveIssues
- Estimated resolution time should be realistic based on situation complexity
- Emotional state must match the conversation tone, not just the stated concern

Respond ONLY in valid JSON:
{
  "summary": "2-3 sentence situation summary the agent reads first",
  "passengerConcern": "the real underlying concern in one sentence",
  "emotionalState": "Frustrated"|"Anxious"|"Angry"|"Distressed"|"Calm"|"Resigned",
  "urgencyLevel": "Critical"|"High"|"Medium"|"Low",
  "whatWasArranged": ["list of recovery actions already taken"],
  "suggestedOpeningLine": "exact words the agent can use to open the conversation",
  "sensitiveIssues": ["anything the agent must be aware of"],
  "recommendedAction": "what the agent should do to resolve this",
  "estimatedResolutionTime": "5 mins"|"10 mins"|"15 mins"|"30 mins+"
}`,
      'cfo-audit': `You are an expert auditor reviewing airline disruption recovery decisions. Analyze the recovery decision and provide a comprehensive audit narrative.

Your narrative should:
1. Summarize the disruption scenario and passenger profile
2. Explain the regulatory framework applied (EU261, US DOT, etc.)
3. Justify the recovery action chosen
4. Break down the financial liability and recovery cost
5. Flag any exceptions or unusual circumstances
6. Conclude with overall decision assessment

Respond ONLY in valid JSON with this structure:
{
  "narrative": "Professional audit narrative (3-4 paragraphs, comprehensive explanation)",
  "regulationCited": "e.g., EU261/2004 or US DOT regulations",
  "liabilityBreakdown": {
    "description": "breakdown of liability components",
    "gross": number (gross liability),
    "recovery": number (recovery cost),
    "net": number (net savings)
  },
  "exceptionFlag": boolean (true if this case has exceptional circumstances),
  "exceptionNote": "explanation of flagged exception or empty string"
}`,
    };

    const systemPrompt = systemPrompts[useCase] || systemPrompts['gate-agent'];

    let userMessage = '';
    if (useCase === 'passenger-chat') {
      const ctx = payload.passengerContext || {};
      const message = payload.message || '';
      userMessage = `Passenger message: "${message}"

Passenger Context:
- PNR: ${ctx.pnr}
- Name: ${ctx.name}
- Flight: ${ctx.flightNumber} (${ctx.origin} → ${ctx.destination})
- Disruption: ${ctx.disruptionType}
- Delay: ${ctx.delayHours} hours`;
    } else if (useCase === 'whatsapp-message') {
      const ctx = payload.passengerContext || {};
      const recovery = payload.recoveryDecision || {};
      userMessage = `Generate a WhatsApp message for this disrupted passenger:

Passenger Context:
- Name: ${ctx.name}
- PNR: ${ctx.pnr}
- Cabin: ${ctx.cabin} (Tier: ${ctx.tier})
- Flight: ${ctx.flightNumber} (${ctx.origin} → ${ctx.destination})
- Disruption: ${ctx.disruptionType}
- Delay: ${ctx.delayHours} hours
- Jurisdiction: ${ctx.jurisdiction}

Recovery Decision:
- Primary Action: ${recovery.primaryAction}
- Distress Level: ${recovery.distressLevel}
- Tone: ${recovery.tone}
- Lounge Required: ${recovery.recoveryDecision?.loungeRequired || false}
- Meals Required: ${recovery.recoveryDecision?.mealsRequired || false}
- Hotel Required: ${recovery.recoveryDecision?.hotelRequired || false}`;
    } else if (useCase === 'escalation-handoff') {
      const pax = payload.passenger || {};
      const recovery = payload.recoveryArranged || {};
      const history = payload.conversationHistory || [];
      userMessage = `Prepare a gate agent handoff briefing for this escalated passenger:

Passenger:
- Name: ${pax.name}
- PNR: ${pax.pnr}
- Flight: ${pax.flightNumber} (${pax.origin} → ${pax.destination})
- Cabin: ${pax.cabin}
- Disruption: ${pax.disruptionType}, Delay: ${pax.delayMinutes} minutes
- Jurisdiction: ${pax.jurisdiction}

Recovery Already Arranged:
- Primary Action: ${recovery.primaryAction}
- Meal Voucher: ${recovery.mealVoucher}
- Lounge Access: ${recovery.loungeAccess}
- Hotel: ${recovery.hotelArranged}
- Rebook Eligible: ${recovery.rebookEligible}

Conversation History:
${history.map((m) => `${m.role === 'user' ? 'PASSENGER' : 'ASSISTANT'}: ${m.content}`).join('\n\n')}

Detected Stress Signals: ${payload.stressSignals?.join(', ') || 'None'}

Escalation Reason: ${payload.escalationReason}

AI Assessed Distress Level: ${payload.aiDistressLevel}

Flagged Issues: ${payload.aiFlaggedIssues?.join(', ') || 'None'}`;
    } else if (useCase === 'cfo-audit') {
      const recoveryRecord = payload;
      userMessage = `Recovery Decision for Audit:
Passenger: ${recoveryRecord.passenger?.name} (${recoveryRecord.passenger?.pnr})
Flight: ${recoveryRecord.passenger?.flightNumber} ${recoveryRecord.passenger?.origin} → ${recoveryRecord.passenger?.destination}
Tier: ${recoveryRecord.passenger?.tier}, Cabin: ${recoveryRecord.passenger?.cabin}
Disruption: ${recoveryRecord.passenger?.disruptionReason}, Delay: ${recoveryRecord.passenger?.delayHours}h

Jurisdiction: ${recoveryRecord.passenger?.jurisdiction}
Recovery Action: ${recoveryRecord.recommendedAction}

Financial Impact:
- Gross Liability: €${recoveryRecord.legacy?.total || 0}
- Recovery Cost: €${recoveryRecord.aeroAgentCost || 0}
- Net Savings: €${recoveryRecord.netSavings || 0}

Override Applied: ${recoveryRecord.overrideAction ? `Yes (${recoveryRecord.overrideAction}) - Rationale: ${recoveryRecord.overrideRationale}` : 'No'}

Provide a comprehensive audit narrative analyzing this recovery decision.`;
    } else {
      userMessage = `Passenger: ${JSON.stringify(payload.passenger, null, 2)}\n\nAnalysis Context: ${JSON.stringify(payload.analysis || {}, null, 2)}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
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

    // Clean up response if it has markdown code blocks
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', cleanedText.substring(0, 200));
      return res.status(500).json({
        error: 'Claude API unavailable',
        details: 'Invalid JSON response from Claude'
      });
    }

    console.log(`[${new Date().toISOString()}] Claude API success | useCase: ${useCase} | PNR: ${pnr}`);

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

const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ API Server running at http://localhost:${PORT}/api/claude`);
});
