# Claude API Serverless Function Setup

## Files Created

✅ **api/claude.ts** - Vercel serverless function with full TypeScript types
- Accepts POST requests with `{ useCase, payload }`
- Routes to three system prompts: gate-agent, passenger-chat, cfo-audit
- Calls Anthropic Claude API with proper authentication
- Returns parsed JSON responses

✅ **.env.local** - Environment variables (development)
- `ANTHROPIC_API_KEY=your_key_here`

✅ **vercel.json** - Vercel deployment configuration
- Rewrites `/api/*` requests

✅ **vite.config.ts** - Updated with API proxy
- Proxies `/api` requests to local development server

✅ **package.json** - Updated with @vercel/node
- Added `@vercel/node` for serverless function types

✅ **src/lib/utils.ts** - Created utility functions
- `cn()` classname utility using clsx + tailwind-merge

---

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

This will install @vercel/node and all other dependencies.

### 2. Add Anthropic API Key
Edit `.env.local` and replace `your_key_here` with your actual API key:
```
ANTHROPIC_API_KEY=sk-ant-v4-xxx...
```

### 3. Local Development

#### Option A: Using Vite Dev Server (Recommended)
```bash
npm run dev
```
This runs the Vite dev server on port 3000 with the proxy configured.

#### Option B: Using Vercel CLI (Full-Featured)
```bash
npm install -g vercel
vercel dev
```
This runs both the Vite app and serverless functions locally.

---

## API Endpoint

**Local Dev:** `http://localhost:3000/api/claude`  
**Production (Vercel):** `https://your-vercel-domain.vercel.app/api/claude`

### Request Format
```typescript
POST /api/claude
Content-Type: application/json

{
  "useCase": "gate-agent" | "passenger-chat" | "cfo-audit",
  "payload": {
    // Use-case specific payload (see below)
  }
}
```

---

## Use Cases & Payloads

### 1. Gate Agent Recovery Advice
```typescript
{
  "useCase": "gate-agent",
  "payload": {
    "passenger": { /* Passenger object */ },
    "analysis": { /* AnalysisResult from engine */ }
  }
}
```

**Response Type:** `GateAgentResponse`
```typescript
{
  "recommendedAction": "rebook_same_metal" | "rebook_partner" | "rebook_interline" | "hotel_and_meals" | "meal_voucher" | "lounge_access" | "compensation" | "notification_only" | "escalate",
  "details": string,
  "justification": string,
  "distressLevel": "Critical" | "High" | "Medium" | "Low",
  "distressReason": string,
  "estimatedLiability": number,
  "currency": "EUR" | "USD" | "AED",
  "regulatoryBasis": "EU261" | "USDOT" | "Goodwill" | "None",
  "regulatoryNote": string,
  "priorityScore": number
}
```

### 2. Passenger Chat Response
```typescript
{
  "useCase": "passenger-chat",
  "payload": {
    "message": "passenger's chat message",
    "passengerContext": { /* Passenger object */ }
  }
}
```

**Response Type:** `PassengerChatResponse`
```typescript
{
  "message": string,
  "stressSignals": string[],
  "escalate": boolean,
  "escalationReason": string | null,
  "updatedDistressLevel": "Critical" | "High" | "Medium" | "Low"
}
```

### 3. CFO Audit Narrative
```typescript
{
  "useCase": "cfo-audit",
  "payload": {
    "passenger": { /* Passenger object */ },
    "actionTaken": "action description",
    "analysis": { /* AnalysisResult from engine */ }
  }
}
```

**Response Type:** `CFOAuditResponse`
```typescript
{
  "narrative": string,
  "regulationCited": string,
  "liabilityBreakdown": string,
  "exceptionFlag": boolean,
  "exceptionNote": string | null
}
```

---

## Integration with Frontend

### Example: Gate Agent Portal
```typescript
const response = await fetch('/api/claude', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    useCase: 'gate-agent',
    payload: {
      passenger: selectedPax,
      analysis: computeEngine(selectedPax)
    }
  })
});

const { data } = await response.json();
// data is GateAgentResponse with AI advice
```

### Example: Passenger Chat
```typescript
const response = await fetch('/api/claude', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    useCase: 'passenger-chat',
    payload: {
      message: userMessage,
      passengerContext: passenger
    }
  })
});

const { data } = await response.json();
// data is PassengerChatResponse with AI-generated message
```

---

## Error Handling

The endpoint returns HTTP 500 with error details on failure:
```json
{
  "error": "Claude API unavailable",
  "details": "specific error message"
}
```

Common errors:
- `ANTHROPIC_API_KEY is not set` - Missing environment variable
- `Invalid useCase` - Unknown use case provided
- `Missing useCase or payload` - Incomplete request body
- `Invalid JSON response from Claude API` - Claude returned malformed JSON

---

## Deployment to Vercel

1. Push code to GitHub
2. Connect repo to Vercel
3. Add `ANTHROPIC_API_KEY` to Vercel environment variables
4. Deploy

Vercel automatically recognizes the `api/` directory and deploys serverless functions.

---

## Notes

- Claude model: `claude-sonnet-4-20250514`
- Max tokens: 1024 (configurable in api/claude.ts)
- All responses must be valid JSON (enforced by API)
- System prompts guide Claude to specific response formats
- Anthropic API version: `2023-06-01`
