/*
 * SYNC REQUIRED — must match dev-server.js
 * - PASSENGER_CHAT_SYSTEM_PROMPT
 * - buildUserMessage (passenger-chat branch)
 * - passenger-chat model: claude-haiku-4-5-20251001
 * - passenger-chat max_tokens: 450
 * - server safety net: passengerCount >= 3
 * Last verified in sync: 2026-05-30
 */
import { VercelRequest, VercelResponse } from '@vercel/node';

// MOD 3: Recovery Option structure
interface RecoveryOption {
  id: string;
  title: string;
  description: string;
  primaryAction: string;
  costToAeroAgent: number;
  passengerValue: string;
  timeline: string;
  regulatoryBasis: string;
  suitabilityReason: string;
  flaggedConcerns?: string[];
}

// Gate Agent Response Types
interface GateAgentResponse {
  recommendedAction: string;
  details: string;
  justification: string;
  distressLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  distressReason: string;
  regulatoryBasis: 'EU261' | 'USDOT' | 'APPR' | 'Goodwill' | 'None';
  regulatoryNote: string;
  priorityScore: number;
  flaggedIssues?: string[];
  agentTalkingPoints?: string[];
  recoveryOptions?: RecoveryOption[]; // MOD 3: Multiple options
}

// Passenger Chat Response Types
interface PassengerChatResponse {
  message: string;
  escalationReady: boolean;
  vagueResponseCount: number;
  gatheredContext: {
    passengerConcern: string;
    emotionalState: 'Calm' | 'Anxious' | 'Frustrated' | 'Angry' | 'Distressed';
    urgencyFlag: boolean;
    cooperationLevel: 'cooperative' | 'vague' | 'refused';
    keyDetails: string[];
  };
}

// CFO Audit Response Types
interface CFOAuditResponse {
  narrative: string;
  regulationCited: string;
  liabilityBreakdown: string;
  exceptionFlag: boolean;
  exceptionNote: string | null;
}

// WhatsApp Message Response Types
interface WhatsappMessageResponse {
  message: string;
  messageType: string;
  tone: 'neutral' | 'apologetic' | 'empathetic' | 'urgent';
  includedElements: string[];
  qrCodeRequired: boolean;
  qrCodeType: 'voucher' | 'lounge' | 'ticket' | null;
}

// Escalation Handoff Response Types
interface EscalationHandoffResponse {
  summary: string;
  passengerConcern: string;
  emotionalState: 'Frustrated' | 'Anxious' | 'Angry' | 'Distressed' | 'Calm' | 'Resigned';
  urgencyLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  whatWasArranged: string[];
  suggestedOpeningLine: string;
  sensitiveIssues: string[];
  recommendedAction: string;
  estimatedResolutionTime: '5 mins' | '10 mins' | '15 mins' | '30 mins+';
}

// Union type for all possible responses
type ClaudeResponse = GateAgentResponse | PassengerChatResponse | CFOAuditResponse | WhatsappMessageResponse | EscalationHandoffResponse;

// Request body types
interface ClaudeRequest {
  useCase: 'gate-agent' | 'passenger-chat' | 'cfo-audit' | 'whatsapp-message' | 'escalation-handoff';
  payload: Record<string, any>;
}

// Anthropic API Message type
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Anthropic API Request body
interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  system: string;
  messages: AnthropicMessage[];
}

// Anthropic API Response type
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const GATE_AGENT_SYSTEM_PROMPT = `You are an AI recovery advisor for airline gate agents. You receive a passenger summary and pre-computed rule engine assessment. Do NOT recompute rules — validate and enhance them.

Your job:
1. Write a 2-sentence justification the gate agent reads in 5 seconds
2. Assess distress level holistically
3. Flag unusual issues (UMNR, medical, connection risk, downgrade consent)
4. Generate 2-3 recovery options

Key rules:
- EU261 extraordinary circumstances (weather/ATC/security): duty of care owed, cash comp WAIVED (Article 5(3))
- UMNR: own airline only, daytime flights, call guardian
- Downgrade: premium passenger consent required
- APPR large carrier: reroute on any carrier if delay > 9h
- Goodwill: always notify; lounge for Business/First 90min+; meals for all 3h+

Respond ONLY in valid JSON:
{
  "recommendedAction": string,
  "details": "one sentence",
  "justification": "2 sentences — plain English, warm, explains the why",
  "distressLevel": "Critical"|"High"|"Medium"|"Low",
  "distressReason": "one sentence",
  "regulatoryBasis": "EU261"|"USDOT"|"APPR"|"Goodwill"|"None",
  "regulatoryNote": "one sentence",
  "priorityScore": number 0-100,
  "flaggedIssues": ["array or empty"],
  "agentTalkingPoints": ["2-3 points"],
  "recoveryOptions": [
    {
      "id": "option-1",
      "title": string,
      "description": "one sentence",
      "primaryAction": string,
      "costToAeroAgent": number,
      "passengerValue": string,
      "timeline": string,
      "regulatoryBasis": string,
      "suitabilityReason": string,
      "flaggedConcerns": []
    }
  ]
}`;

const PASSENGER_CHAT_SYSTEM_PROMPT = `You are a professional airline disruption assistant speaking directly to a disrupted passenger via chat.

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
}`;

const CFO_AUDIT_SYSTEM_PROMPT = `You are a regulatory compliance analyst generating formal audit narratives for airline recovery decisions.

You have expert knowledge of:
- EU261/2004 and UK261 passenger rights with Article 5(3) extraordinary circumstances and Article 9 duty of care
- US DOT Part 250 refund regulations and tarmac delay rules
- Canada APPR large/small carrier rules with jurisdiction-specific thresholds
- Airline duty of care obligations (meals, hotels, transport, communication)
- IROPS recovery best practices and cost optimization

CRITICAL: Always provide ALL 8 required JSON fields in your response, even if some are empty/null.

ANALYSIS FRAMEWORK:

Step 1: Determine applicable jurisdiction regulation
Step 2: Assess if cause is controllable (determines liability)
Step 3: Confirm what was provided vs. what was owed
Step 4: Calculate financial impact (gross liability, recovery cost, net)
Step 5: Assign complianceStatus: Compliant (meets all obligations) | Review Required (gaps exist) | Non-Compliant (breaches detected)
Step 6: Assign auditRiskLevel: Low (straightforward, clear) | Medium (complex or minor issues) | High (significant gaps/breaches)
Step 7: Determine exceptionFlag: true if complianceStatus != "Compliant" OR any concern exists
Step 8: List required documentation for audit trail

Respond ONLY in this exact JSON format - all 8 fields required:
{
  "narrative": "4-5 sentence professional narrative: disruption context, applicable regulation and article, passenger entitlements, actions taken, compliance assessment",
  "regulationCited": "e.g., EU261/2004 Article 7, US DOT Part 250, Canada APPR (Large Carrier)",
  "liabilityBreakdown": {
    "description": "specific calculation methodology (e.g., gross = €600 comp + €250 hotel; recovery = €520 rebook; net = €330 savings)",
    "gross": number,
    "recovery": number,
    "net": number
  },
  "complianceStatus": "Compliant" or "Review Required" or "Non-Compliant",
  "exceptionFlag": boolean (true if any concern or non-compliance),
  "exceptionNote": "specific issue if flagged, null if compliant",
  "auditRiskLevel": "Low" or "Medium" or "High",
  "recommendedDocumentation": ["PNR record", "disruption proof", ...]
}`;

const WHATSAPP_MESSAGE_SYSTEM_PROMPT = `You are a warm, empathetic airline communication specialist creating WhatsApp messages for disrupted passengers. Your goal is to provide human-feeling, personalized messages that acknowledge passenger stress, explain the situation, confirm recovery actions, and offer escalation when needed.

TONE GUIDANCE by Disruption Severity:
- Critical (15h+ delay, cancellation) → Urgent, deeply apologetic, solution-focused
- High (9-15h delay) → Empathetic, acknowledges impact, clear actions
- Medium (3-9h delay) → Apologetic, reassuring, offers support
- Low (90min-3h delay) → Professional, helpful, acknowledges inconvenience

MESSAGE STRUCTURE (follow this flow):
1. Emotional opening: Acknowledge passenger's situation with warmth and understanding
2. What happened: Brief, clear explanation (1 sentence max)
3. What we've arranged: Specific recovery action (meals, lounge, hotel, rebook, etc.)
4. Action needed: What the passenger should do next (claim lounge, check email, contact us)
5. Escalation option: "Need immediate help? Reply with 'HELP'"

SPECIFICS:
- Keep messages to 2-3 sentences maximum for clarity
- Use passenger's first name if available
- Include flight number (e.g., QF123 HEL→JFK)
- For vouchers/lounge: Include QR code placeholder as [QR CODE PLACEHOLDER]
- Premium passengers (Business/First): Mention specific amenities (premium lounge, seat upgrade)
- Economy passengers: Focus on practical support (meals, basic lounge access)
- If hotel arranged: Mention specific hotel name if provided
- If rebook pending: Include approximate new flight time
- Never be robotic or formal — speak like a caring airline representative

QR CODE GUIDANCE:
- Include [QR CODE PLACEHOLDER] for meal vouchers, lounge access, or ticket changes
- For multi-step actions (claim lounge + meal): use single QR code pointing to portal

PAYMENT/COMPENSATION RULES:
- Refunds: "We'll process a full refund to your original payment method within 7 days"
- Cash compensation (EU261): "€250-400 compensation will be processed separately per regulations"
- Goodwill vouchers: Include as separate offer after primary recovery action

MOD 6: THREE MESSAGE TYPES - consolidated approach:
- INFORMATIONAL: Status updates, delay info, timeline (no immediate action)
- ACTIONABLE: Recovery arranged with instructions and QR code
- ESCALATION: Complex case requiring human agent intervention

Respond ONLY in valid JSON:
{
  "message": "the complete WhatsApp message text",
  "messageType": "INFORMATIONAL|ACTIONABLE|ESCALATION",
  "tone": "neutral"|"apologetic"|"empathetic"|"urgent",
  "includedElements": ["array: flight_info, passenger_name, recovery_action, qr_code, escalation_option"],
  "qrCodeRequired": true|false,
  "qrCodeType": "voucher"|"lounge"|"ticket"|null,
  "requiresFollowUp": true|false
}`;

const ESCALATION_HANDOFF_SYSTEM_PROMPT = `You are an AI triage assistant preparing a handoff briefing for an airline gate agent who is about to join a disrupted passenger conversation.

Your job is to analyse the full conversation history and passenger context, then produce a concise, structured briefing the agent can read in 15 seconds before joining.

The briefing must tell the agent:
1. Who the passenger is and their situation
2. What the passenger's real concern is (not just what they said — what they mean)
3. What emotional state they are in
4. What has already been arranged for them
5. What the agent should do or say first
6. Any sensitive issues to be aware of

GUIDELINES:
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
  "suggestedOpeningLine": "exact words the agent can use to open the conversation — warm, personal, shows they already know the situation",
  "sensitiveIssues": ["anything the agent must be aware of — medical, minor, previous disruption etc"],
  "recommendedAction": "what the agent should do to resolve this",
  "estimatedResolutionTime": "5 mins"|"10 mins"|"15 mins"|"30 mins+"
}`;

function getSystemPrompt(useCase: string): string {
  switch (useCase) {
    case 'gate-agent':
      return GATE_AGENT_SYSTEM_PROMPT;
    case 'passenger-chat':
      return PASSENGER_CHAT_SYSTEM_PROMPT;
    case 'cfo-audit':
      return CFO_AUDIT_SYSTEM_PROMPT;
    case 'whatsapp-message':
      return WHATSAPP_MESSAGE_SYSTEM_PROMPT;
    case 'escalation-handoff':
      return ESCALATION_HANDOFF_SYSTEM_PROMPT;
    default:
      throw new Error(`Unknown use case: ${useCase}`);
  }
}

function buildUserMessage(useCase: string, payload: Record<string, any>): string {
  switch (useCase) {
    case 'gate-agent':
      return `Passenger: ${JSON.stringify(payload.passenger, null, 2)}\n\nRule Engine Assessment: ${JSON.stringify(payload.ruleEngineAssessment, null, 2)}`;
    case 'passenger-chat': {
      const { message, passengerContext = {}, conversationHistory = [] } = payload;
      const { firstName, destination, delayMinutes, disruptionType } = passengerContext;

      // Build conversation history as plain text summary
      const historyText = conversationHistory.length > 0
        ? conversationHistory
            .map((m: { role: string; content: string }) =>
              m.role === 'user' ? `Passenger: ${m.content}` : `AeroAgent: ${m.content}`
            )
            .join('\n\n')
        : '';

      return `Passenger: ${firstName}
Flight: ${delayMinutes} min disruption to ${destination}
Type: ${disruptionType}

Conversation so far:
${historyText}

Latest message: "${message}"

Continue the conversation. Your goal is to understand their situation.
Remember: ask broad questions only. Never ask specific personal details.
Never offer solutions.`;
    }

    case 'cfo-audit':
      return `Passenger: ${JSON.stringify(payload.passenger, null, 2)}\n\nRecovery Action Taken: ${payload.actionTaken}\n\nAnalysis: ${JSON.stringify(payload.analysis, null, 2)}`;
    case 'whatsapp-message':
      return `Generate a WhatsApp message for this disrupted passenger:\n\nPassenger Context:\n${JSON.stringify(payload.passengerContext, null, 2)}\n\nRecovery Decision:\n${JSON.stringify(payload.recoveryDecision, null, 2)}`;
    case 'escalation-handoff':
      return `Prepare a gate agent handoff briefing for this escalated passenger:\n\nPassenger:\n${JSON.stringify(payload.passenger, null, 2)}\n\nRecovery Already Arranged:\n${JSON.stringify(payload.recoveryArranged, null, 2)}\n\nConversation History:\n${(payload.conversationHistory || []).map((m: any) => `${m.role === 'user' ? 'PASSENGER' : 'ASSISTANT'}: ${m.content}`).join('\n\n')}\n\nDetected Stress Signals: ${(payload.stressSignals || []).join(', ')}\n\nEscalation Reason: ${payload.escalationReason}\n\nAI Assessed Distress Level: ${payload.aiDistressLevel}\n\nFlagged Issues: ${(payload.aiFlaggedIssues || []).join(', ')}`;
    default:
      throw new Error(`Unknown use case: ${useCase}`);
  }
}

async function callClaudeAPI(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 400,
  model: string = 'claude-sonnet-4-6',
  messagesOverride?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[callClaudeAPI] ANTHROPIC_API_KEY is not set');
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  console.log('[callClaudeAPI] API key found, length:', apiKey.length);

  const requestBody: AnthropicRequestBody = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messagesOverride ?? [{ role: 'user', content: userMessage }]
  };

  console.log('[callClaudeAPI] Sending request to Anthropic API:', {
    model: requestBody.model,
    messageCount: requestBody.messages.length,
    userMessageLength: userMessage.length
  });

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });
  } catch (fetchError) {
    console.error('[callClaudeAPI] Fetch failed:', {
      message: fetchError instanceof Error ? fetchError.message : 'Unknown'
    });
    throw fetchError;
  }

  console.log('[callClaudeAPI] Response received:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('[callClaudeAPI] Anthropic API error response:', {
      status: response.status,
      statusText: response.statusText,
      body: errorData
    });
    throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorData}`);
  }

  let data: AnthropicResponse;
  try {
    data = await response.json();
    console.log('[callClaudeAPI] Response parsed successfully');
  } catch (parseError) {
    console.error('[callClaudeAPI] Failed to parse response JSON:', {
      message: parseError instanceof Error ? parseError.message : 'Unknown'
    });
    throw parseError;
  }

  console.log('[callClaudeAPI] Response structure:', {
    hasContent: !!data.content,
    contentLength: data.content?.length,
    firstContentType: data.content?.[0]?.type
  });

  if (!data.content || !data.content[0] || data.content[0].type !== 'text') {
    console.error('[callClaudeAPI] Unexpected response structure:', JSON.stringify(data));
    throw new Error('Unexpected response structure from Claude API');
  }

  console.log('[callClaudeAPI] Returning text content, length:', data.content[0].text.length);
  return data.content[0].text;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // DIAGNOSTIC BLOCK - Log request details
  console.log('[AeroAgent API] Request received:', {
    method: req.method,
    useCase: req.body?.useCase,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) ?? 'NOT FOUND',
    timestamp: new Date().toISOString()
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.error('[AeroAgent API] Invalid method:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { useCase, payload } = req.body as ClaudeRequest;

    console.log('[AeroAgent API] Parsed request:', {
      useCase,
      hasPayload: !!payload,
      payloadKeys: payload ? Object.keys(payload) : []
    });

    // Validate input
    if (!useCase || !payload) {
      console.error('[AeroAgent API] Missing required fields:', { useCase, payload });
      res.status(400).json({ error: 'Missing useCase or payload' });
      return;
    }

    if (!['gate-agent', 'passenger-chat', 'cfo-audit', 'whatsapp-message', 'escalation-handoff'].includes(useCase)) {
      console.error('[AeroAgent API] Invalid useCase:', useCase);
      res.status(400).json({ error: `Invalid useCase: ${useCase}` });
      return;
    }

    // Get system prompt for use case
    const systemPrompt = getSystemPrompt(useCase);
    console.log('[AeroAgent API] System prompt loaded for:', useCase);

    // Build user message from payload
    const userMessage = buildUserMessage(useCase, payload);
    console.log('[AeroAgent API] User message built, length:', userMessage.length);

    // Call Claude API with detailed error handling
    let responseText: string;
    try {
      console.log('[AeroAgent API] Calling Claude API...');
      const tokenLimit = useCase === 'passenger-chat' ? 450 : 400;
      const model = useCase === 'passenger-chat' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
      responseText = await callClaudeAPI(systemPrompt, userMessage, tokenLimit, model);
      console.log('[AeroAgent API] Claude API response received, length:', responseText.length);
    } catch (apiError) {
      console.error('[AeroAgent API] Claude API call failed:', {
        message: apiError instanceof Error ? apiError.message : 'Unknown',
        stack: apiError instanceof Error ? apiError.stack : undefined
      });

      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      res.status(500).json({
        error: 'Claude API unavailable',
        details: errorMessage
      });
      return;
    }

    // Parse response based on useCase (all useCases return JSON)
    let parsedResponse: ClaudeResponse;
    try {
      // Clean up response (remove markdown fences if present)
      const cleaned = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      console.log('[AeroAgent API] Attempting to parse response, cleaned length:', cleaned.length);
      console.log('[AeroAgent API] Response preview:', cleaned.substring(0, 200));

      parsedResponse = JSON.parse(cleaned);
      console.log('[AeroAgent API] Successfully parsed response');
    } catch (parseError) {
      console.error('[AeroAgent API] Failed to parse Claude response as JSON:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown',
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500)
        });
        res.status(500).json({
          error: 'Invalid JSON response from Claude API',
          details: 'Claude did not return valid JSON'
        });
        return;
      }

    // Return parsed response to frontend
    console.log('[AeroAgent API] Returning success response');
    res.status(200).json({
      success: true,
      useCase,
      data: parsedResponse
    });

  } catch (error) {
    console.error('[AeroAgent API] Unhandled error:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Claude API unavailable',
      details: errorMessage
    });
  }
}
