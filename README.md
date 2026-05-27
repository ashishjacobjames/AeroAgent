# AeroAgent v2.5
### AI-Powered IROPS Recovery Orchestrator

AeroAgent reimagines airline disruption recovery through three AI-powered stakeholder portals — Gate Agent, Passenger, and CFO Auditor — all reasoning in real time via Claude (Anthropic).

**Live demo:** [Deploy to Vercel](#deploy-to-vercel)

## 🎯 Features

### Gate Agent Portal
- ✦ Real-time passenger triage queue with AI-powered recovery recommendations
- Claude-generated plain-English justifications for each decision
- Distress level assessment (Critical/High/Medium/Low) and regulatory risk detection
- Manual override capability with audit trail
- Escalation to passenger chat for complex cases

### Passenger Experience Portal
- ✦ WhatsApp-style chat interface powered by Claude
- Proactive opening message explaining disruption and recovery options
- Real-time stress signal detection (angry, anxious, health concerns, family_separation, financial_hardship)
- Seamless escalation to gate agents when needed
- Mobile-optimized responsive design

### CFO / Auditor Portal
- ✦ Financial dashboard with AI-generated audit narratives
- KPI summary: Total disruptions, Total liability, AI narratives generated, Exceptions flagged
- AI-generated audit narrative for every recovery decision with regulation citation
- Exception flagging for unusual cases with detailed explanations
- Liability breakdown analysis (Gross → Recovery → Net)
- CSV export of audit log with AI narratives and decisions
- Override rate and automation metrics visualization

## 🔌 AI Integration

All three portals integrate with **Claude (Anthropic API)** for intelligent decision-making:

- **gate-agent** use case: Recovery recommendations, distress assessment, regulatory analysis
- **passenger-chat** use case: Conversational support, stress signal detection, de-escalation
- **cfo-audit** use case: Audit narrative generation, exception detection, compliance verification

Model: `claude-opus-4-1-20250805`

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (installed)
- npm 9+
- Anthropic API key

### Local Setup

```bash
# Clone repository
git clone <repo-url>
cd AeroAgent

# Install dependencies
npm install

# Add Anthropic API key to .env.local
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# Start dev servers (in separate terminals)
npm run dev:vite        # Frontend on http://localhost:3000
node api-server.js      # API server on http://localhost:3001
```

The app will be available at `http://localhost:3000` with hot module reloading enabled.

## 🚀 Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "AeroAgent v2.5"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select "AeroAgent" project

3. **Add environment variables**
   - Set `ANTHROPIC_API_KEY` in the Vercel project settings
   - Value: your Anthropic API key (from https://console.anthropic.com)

4. **Deploy**
   - Click "Deploy"
   - Vercel builds and deploys automatically
   - Live in ~2 minutes

The app will be available at `https://your-project.vercel.app`

## 🏗️ Architecture

```
AeroAgent/
├── src/
│   ├── App.tsx                    # Main app (all 3 portals)
│   ├── engine.ts                  # computeEngineLocal & computeEngineAI
│   ├── seed.ts                    # Mock data generation (250+ passengers)
│   ├── types.ts                   # TypeScript type definitions
│   ├── main.tsx                   # React entry point
│   ├── components/
│   │   ├── UI.tsx                 # Reusable UI components
│   │   └── RationalePanel.tsx      # Financial breakdown display
│   └── lib/
│       └── utils.ts
├── api/
│   └── claude.ts                  # Vercel serverless function
├── api-server.js                  # Local Express API (port 3001)
├── vercel.json                    # Vercel configuration
├── .env.local                     # Local env vars (not in git)
├── vite.config.ts                 # Vite configuration
├── tailwind.config.ts             # Tailwind CSS v4 configuration
├── package.json                   # Dependencies
└── tsconfig.json                  # TypeScript configuration
```

## 🔧 Technology Stack

| Technology | Purpose |
|-----------|---------|
| **React 19** | UI framework |
| **TypeScript** | Type-safe development |
| **Vite** | Fast build tool & dev server |
| **Tailwind CSS v4** | Utility-first CSS framework |
| **Framer Motion** | Smooth animations & transitions |
| **Recharts** | Data visualization (charts) |
| **Lucide React** | Icon library |
| **date-fns** | Date manipulation |
| **Claude API** | AI reasoning engine |
| **Express** | Local API server |
| **Vercel** | Serverless hosting |

## 📊 Data Flow

1. **Seed Data** (`src/seed.ts`)
   - Generates 250+ passengers with realistic disruption scenarios
   - Distributed across 5 disruption types and 5 routes

2. **Local Decision Engine** (`src/engine.ts`)
   - `computeEngineLocal()`: Deterministic rules-based logic
   - `computeEngineAI()`: Calls Claude API for AI-powered analysis
   - Fallback: If API unavailable, uses local engine automatically

3. **Claude AI Analysis**
   - Gate Agent: Justification, distress level, regulatory basis
   - Passenger: Conversational response, stress signals, escalation detection
   - CFO: Audit narrative, regulation cited, exception flagging

4. **UI Rendering**
   - Components display enriched passenger data with AI analysis
   - Interactive filtering, search, and sorting
   - Real-time KPI calculations and metrics

## 🌐 Deploy to Vercel

### One-Click Deploy
1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/new)
3. Connect your GitHub repository
4. Add environment variable: `ANTHROPIC_API_KEY=sk-ant-...`
5. Click Deploy

### Manual Deploy
```bash
npm install -g vercel
vercel env add ANTHROPIC_API_KEY
vercel
```

### What Happens
- Frontend (React/Vite) deploys as static site
- `api/claude.ts` becomes serverless function at `/api/claude`
- All API calls from frontend route through Vercel function
- Anthropic API key is secure server-side only

## 🔒 Security

✅ API key never exposed in frontend code  
✅ All sensitive operations on backend  
✅ CORS properly configured  
✅ TypeScript strict mode enabled  
✅ Environment variables managed via `.env.local` (dev) / Vercel (prod)  
✅ No hardcoded secrets in repository  

## 🧪 Testing Locally

```bash
# Test Gate Agent AI analysis
curl -X POST http://localhost:3001/api/claude \
  -H "Content-Type: application/json" \
  -d '{"useCase":"gate-agent","payload":{"passenger":{"name":"Test"},"analysis":{}}}'

# Test Passenger chat
curl -X POST http://localhost:3001/api/claude \
  -H "Content-Type: application/json" \
  -d '{"useCase":"passenger-chat","payload":{"disruptionContext":{},"conversationHistory":[],"latestMessage":"INIT"}}'

# Test CFO audit
curl -X POST http://localhost:3001/api/claude \
  -H "Content-Type: application/json" \
  -d '{"useCase":"cfo-audit","payload":{"passenger":{},"recommendedAction":"Same Metal Recovery"}}'
```

## 🔄 Building for Production

```bash
npm run build
npm run preview
```

Built files go to `/dist` folder (ready for deployment to Vercel).

## 🐛 Troubleshooting

**Port 3000/3001 already in use?**
```bash
# Kill processes
lsof -i :3000 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
lsof -i :3001 | grep -v COMMAND | awk '{print $2}' | xargs kill -9

# Or use different ports
npm run dev:vite -- --port 3002
node api-server.js  # Change port in api-server.js
```

**Claude API returning 404?**
- Check `ANTHROPIC_API_KEY` is set in `.env.local`
- Verify API key is valid on [Anthropic console](https://console.anthropic.com)
- Check you have credit balance
- Verify model name: `claude-opus-4-1-20250805`

**Vite not compiling TypeScript?**
```bash
npm run lint  # Check for TS errors
tsc --noEmit  # Full type check
```

**Clear everything and start fresh?**
```bash
rm -rf node_modules dist .next .vercel
npm install
npm run dev:vite
```

## 📄 License

Built for Anthropic Demo. © 2026

---

**Ready to fly!** 🚀 

1. Select a persona at `http://localhost:3000`
2. Gate Agent: View AI-powered recovery recommendations
3. Passenger: Chat with Claude-powered support
4. CFO: Review AI-generated audit narratives
