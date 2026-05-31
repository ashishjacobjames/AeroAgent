import {
  Passenger,
  CabinClass,
  LoyaltyTier,
  SSRCode,
  Jurisdiction,
  DisruptionReason,
  HaulType,
  TimingType,
  ChatMessage,
  DisruptionType,
  DisruptionCause,
  AnalysisResult,
  HandoffBriefing,
  ActionType,
} from './types';
import { addHours, formatISO } from 'date-fns';
import { shouldAutoProcess, computeRuleEngineBaseline } from './engine';

// ─── FLIGHT REGISTRY ────────────────────────────────────────────────────────
const FLIGHTS: Record<string, { origin: string; dest: string; haul: HaulType; flightH: number; eu261Base: number; jurisdiction: Jurisdiction }> = {
  AY836: { origin: 'HEL', dest: 'LHR', haul: 'Medium', flightH: 3,  eu261Base: 400, jurisdiction: 'EU261' },
  AY103: { origin: 'HEL', dest: 'CDG', haul: 'Medium', flightH: 3,  eu261Base: 400, jurisdiction: 'EU261' },
  AY73:  { origin: 'HEL', dest: 'NRT', haul: 'Long',   flightH: 10, eu261Base: 600, jurisdiction: 'EU261' },
  AY131: { origin: 'HEL', dest: 'SIN', haul: 'Long',   flightH: 11, eu261Base: 600, jurisdiction: 'EU261' },
  AY141: { origin: 'HEL', dest: 'BKK', haul: 'Long',   flightH: 10, eu261Base: 600, jurisdiction: 'EU261' },
  AY15:  { origin: 'HEL', dest: 'JFK', haul: 'Long',   flightH: 9,  eu261Base: 600, jurisdiction: 'USDOT_INTERNATIONAL' },
  AY101: { origin: 'HEL', dest: 'ORD', haul: 'Long',   flightH: 9,  eu261Base: 600, jurisdiction: 'USDOT_INTERNATIONAL' },
  AY5:   { origin: 'HEL', dest: 'YVR', haul: 'Long',   flightH: 10, eu261Base: 600, jurisdiction: 'APPR_LARGE' },
  AY806: { origin: 'HEL', dest: 'YYZ', haul: 'Long',   flightH: 9,  eu261Base: 600, jurisdiction: 'APPR_LARGE' },
};

// ─── BUILDER ────────────────────────────────────────────────────────────────
interface Def {
  uid: string;
  pnr: string;
  name: string;
  cabin: CabinClass;
  tier: LoyaltyTier;
  flight: string;
  ticket: number;
  delayH: number;
  dtType: DisruptionType;
  dtReason: DisruptionReason;
  dtCause: DisruptionCause;
  ssr?: SSRCode;
  party?: number;
  intSeat?: boolean;
  partSeat?: boolean;
  hasCon?: boolean;
  conBuf?: number;
  hasInf?: boolean;
  rebook?: 'pending' | 'confirmed' | 'declined' | 'waitlisted';
  escalated?: boolean;
  // Extended fields for demo control
  forcePending?: boolean;
  forceAutoProcessed?: boolean;
  overrideAction?: ActionType;
  overrideRationale?: string;
  chatStateOverride?: Passenger['chatState'];
  handoffBriefing?: HandoffBriefing;
  escalationReason?: string;
  portalOnly?: boolean;
}

function build(now: Date, def: Def): Passenger {
  const f = FLIGHTS[def.flight];
  const dep = addHours(now, 2);
  const arr = addHours(dep, f.flightH);
  const est = addHours(arr, def.delayH);

  const delayMins = Math.round(def.delayH * 60);
  const timing: TimingType = def.delayH >= 8 ? 'Overnight' : 'Day';
  const party = def.party ?? 1;
  const cabin = def.cabin;

  const label = def.dtType === 'CANCELLATION' ? 'flight cancellation' :
    def.dtReason === 'Weather' ? 'adverse weather conditions' :
    def.dtReason === 'ATC' ? 'air traffic control restrictions' :
    def.dtReason === 'Crew Scheduling' ? 'crew scheduling' :
    def.dtReason === 'Late Inbound' ? 'a late-arriving inbound aircraft' :
    'a technical fault';

  const msgs: ChatMessage[] = [{
    role: 'assistant',
    content: `Hyvää päivää — this is AeroAgent on behalf of Finnair. We sincerely apologise for the disruption to flight ${def.flight} to ${f.dest} due to ${label}. Our team is reviewing recovery options right now.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }];

  const p: Passenger = {
    uid: def.uid,
    pnr: def.pnr,
    name: def.name,
    cabin,
    tier: def.tier,
    loyaltyTier: def.tier as Passenger['loyaltyTier'],
    flightNumber: def.flight,
    origin: f.origin,
    destination: f.dest,
    haul: f.haul,
    timing,
    scheduledDeparture: formatISO(dep),
    scheduledArrival: formatISO(arr),
    estimatedArrival: formatISO(est),
    jurisdiction: f.jurisdiction,
    disruptionReason: def.dtReason,
    delayHours: def.delayH,
    delayMinutes: delayMins,
    ticketValue: def.ticket,
    hotelCost: 180,
    oalCost: Math.round(def.ticket * 0.85),
    oalFlightNumber: `BA${def.uid.replace(/[^0-9]/g, '').slice(0, 4) || '1000'}`,
    baseEU261Comp: f.eu261Base,
    internalSeatAvailable: def.intSeat ?? true,
    partnerSeatAvailable: def.partSeat ?? true,
    internalWaitHours: def.delayH + 2,
    ssrCode: def.ssr ?? '',
    partySize: party,
    travelPartySize: party,
    disruptionType: def.dtType,
    disruptionCause: def.dtCause,
    carrierSize: 'large',
    hasConnection: def.hasCon ?? false,
    connectionBufferMinutes: def.conBuf,
    hasInfant: def.hasInf ?? false,
    rebookStatus: def.rebook ?? 'pending',
    rebookConsentRequired: cabin === 'Business' && def.delayH >= 5,
    downgradeOffered: false,
    inventoryConfidenceScore: 0.9,
    status: 'pending_triage',
    isEscalated: def.escalated ?? false,
    chatState: def.chatStateOverride ?? 'initial',
    messages: msgs,
    ...(def.overrideAction    ? { overrideAction:    def.overrideAction    } : {}),
    ...(def.overrideRationale ? { overrideRationale: def.overrideRationale } : {}),
    ...(def.handoffBriefing   ? { handoffBriefing:   def.handoffBriefing   } : {}),
    ...(def.escalationReason  ? { escalationReason:  def.escalationReason  } : {}),
    ...(def.portalOnly        ? { portalOnly: true                          } : {}),
  };

  // Determine status
  if (def.forcePending) {
    p.status = 'pending_triage';
  } else if (def.forceAutoProcessed) {
    p.status = 'auto_processed';
  } else {
    p.status = shouldAutoProcess(p) ? 'auto_processed' : 'pending_triage';
  }

  return p;
}

// ─── SEED ────────────────────────────────────────────────────────────────────
export function generateSeedData(): { passengers: Passenger[]; analysisCache: Record<string, AnalysisResult> } {
  const now = new Date();
  const b = (def: Def) => build(now, def);

  const passengers: Passenger[] = [

    // ══════════════════════════════════════════════════════════════════════
    // GROUP A — 83 passengers — spread across 4 flights
    //
    // Distribution:
    //   28 × Notification only   (delay 0.5–1.5h)  forceAutoProcessed
    //   18 × Meal voucher        (delay 2.0–4.0h)  forceAutoProcessed
    //   10 × Lounge access       (Business/First, delay 3.0–5.0h)  forceAutoProcessed
    //   14 × Rebook same airline (delay 4.0–6.0h)  forceAutoProcessed
    //        — 5 Agent Assisted (overrideAction), 9 AI Resolved
    //    8 × Rebook partner      (Gold+, delay 6.0–8.0h)  forceAutoProcessed
    //        — 5 Agent Assisted (overrideAction), 3 AI Resolved
    //    5 × Hotel overnight     (delay 8.0–10.0h) forceAutoProcessed, overrideAction (all Agent Assisted)
    //
    // First 8 PNRs alphabetically (AA..AH): interleave all action types
    // Remaining 75 use PNRs starting B..Z to sort after
    //
    // Tier: 22 Basic · 22 Silver · 20 Gold · 12 Platinum · 7 oneworld Emerald
    // Cabin: 35 Economy · 20 Premium Economy · 20 Business · 8 First
    // Flights: AY836 ×22 · AY103 ×20 · AY131 ×21 · AY73 ×20
    // ══════════════════════════════════════════════════════════════════════

    // ── First 8 PNRs — interleaved action/mode ──────────────────────────
    // Row 1: Rebook partner · Agent Assisted
    b({ uid:'A-AA3R7M', pnr:'AA3R7M', name:'Nathalie Chen',
        cabin:'Business', tier:'Gold', flight:'AY73', ticket:2200,
        delayH:7.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Partner Metal Recovery',
        overrideRationale:'Gold passenger on long-haul — partner airline rebook arranged by agent' }),

    // Row 2: Notification only · AI Resolved
    b({ uid:'A-AB8KT5', pnr:'AB8KT5', name:'Mikael Bergström',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:215,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Row 3: Hotel overnight · Agent Assisted
    b({ uid:'A-AC2NF6', pnr:'AC2NF6', name:'Catherine Hoffmann',
        cabin:'Business', tier:'Platinum', flight:'AY836', ticket:2450,
        delayH:9.0, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Alternative Flight + Hotel',
        overrideRationale:'Overnight stranding — hotel arranged and next-day rebook confirmed' }),

    // Row 4: Lounge access · AI Resolved
    b({ uid:'A-AD5PX9', pnr:'AD5PX9', name:'Aleksei Petrov',
        cabin:'Business', tier:'Gold', flight:'AY836', ticket:1850,
        delayH:3.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // Row 5: Meal voucher · AI Resolved
    b({ uid:'A-AE7WB3', pnr:'AE7WB3', name:'Fatima Al-Rashid',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:245,
        delayH:2.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // Row 6: Rebook same airline · Agent Assisted
    b({ uid:'A-AF4YG8', pnr:'AF4YG8', name:'Tomás García',
        cabin:'Premium Economy', tier:'Silver', flight:'AY103', ticket:680,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Same Metal Recovery',
        overrideRationale:'Complex technical delay — agent arranged same-airline rebook' }),

    // Row 7: Notification only · AI Resolved
    b({ uid:'A-AG1ZH2', pnr:'AG1ZH2', name:'Siiri Mäkinen',
        cabin:'Economy', tier:'Basic', flight:'AY103', ticket:195,
        delayH:1.0, dtType:'DELAY', dtReason:'Weather', dtCause:'WEATHER',
        forceAutoProcessed:true }),

    // Row 8: Rebook partner · AI Resolved
    b({ uid:'A-AH6RM4', pnr:'AH6RM4', name:'Haruki Yamamoto',
        cabin:'First', tier:'oneworld Emerald', flight:'AY131', ticket:5800,
        delayH:7.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // ══════════════════════════════════════════════════════════════════════
    // AY836 HEL→LHR — 22 passengers total (rows 2,3,4 above + 19 below)
    // ══════════════════════════════════════════════════════════════════════

    // Notification only (10 more on AY836)
    b({ uid:'A-BK3TN9', pnr:'BK3TN9', name:'Emmi Virtanen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:185,
        delayH:0.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-BL7PX2', pnr:'BL7PX2', name:'Lars Söderberg',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:190,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-BM4WZ8', pnr:'BM4WZ8', name:'Inkeri Korhonen',
        cabin:'Economy', tier:'Silver', flight:'AY836', ticket:200,
        delayH:1.0, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-BN9VT3', pnr:'BN9VT3', name:'Helga Eriksson',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:195,
        delayH:1.25, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-BP2RK7', pnr:'BP2RK7', name:'Janne Koivisto',
        cabin:'Economy', tier:'Silver', flight:'AY836', ticket:210,
        delayH:1.5, dtType:'DELAY', dtReason:'Weather', dtCause:'WEATHER',
        forceAutoProcessed:true }),
    b({ uid:'A-BR6HD4', pnr:'BR6HD4', name:'Mika Laukkanen',
        cabin:'Premium Economy', tier:'Silver', flight:'AY836', ticket:590,
        delayH:0.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-BT1YF9', pnr:'BT1YF9', name:'Pia Kuusinen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:188,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-BV5KM3', pnr:'BV5KM3', name:'Timo Karjalainen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:192,
        delayH:1.0, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-BW8NX6', pnr:'BW8NX6', name:'Ritva Hämäläinen',
        cabin:'Economy', tier:'Silver', flight:'AY836', ticket:198,
        delayH:1.25, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-BX3PZ1', pnr:'BX3PZ1', name:'Paavo Tuominen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:205,
        delayH:1.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),

    // Meal voucher (3 on AY836)
    b({ uid:'A-BY7TH5', pnr:'BY7TH5', name:'David Kim',
        cabin:'Premium Economy', tier:'Silver', flight:'AY836', ticket:620,
        delayH:2.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-BZ4WK8', pnr:'BZ4WK8', name:'Sofia Andersen',
        cabin:'Economy', tier:'Gold', flight:'AY836', ticket:320,
        delayH:3.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CB9NR2', pnr:'CB9NR2', name:'Marcus Webb',
        cabin:'Economy', tier:'Silver', flight:'AY836', ticket:290,
        delayH:3.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Lounge access (2 on AY836 — Business/First)
    b({ uid:'A-CD5MX7', pnr:'CD5MX7', name:'Irina Volkov',
        cabin:'Business', tier:'Platinum', flight:'AY836', ticket:2900,
        delayH:4.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CF2HT4', pnr:'CF2HT4', name:'Hans Brandt',
        cabin:'First', tier:'Platinum', flight:'AY836', ticket:4200,
        delayH:4.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook same airline (2 on AY836 — 1 Agent, 1 AI)
    b({ uid:'A-CG8YP6', pnr:'CG8YP6', name:'Kaija Mäkinen',
        cabin:'Premium Economy', tier:'Gold', flight:'AY836', ticket:890,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Same Metal Recovery',
        overrideRationale:'Premium customer — agent confirmed same-airline rebook' }),
    b({ uid:'A-CH4VN9', pnr:'CH4VN9', name:'Erik Lindqvist',
        cabin:'Premium Economy', tier:'Silver', flight:'AY836', ticket:750,
        delayH:5.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // Rebook partner (1 on AY836 — Agent Assisted)
    b({ uid:'A-CJ7KW3', pnr:'CJ7KW3', name:'Olga Petersen',
        cabin:'Business', tier:'Gold', flight:'AY836', ticket:2100,
        delayH:7.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Partner Metal Recovery',
        overrideRationale:'Gold business passenger — partner airline rebook arranged' }),

    // Hotel overnight (1 on AY836 — Agent Assisted)
    b({ uid:'A-CK2BT5', pnr:'CK2BT5', name:'Sven Thorvaldsen',
        cabin:'Business', tier:'Platinum', flight:'AY836', ticket:2700,
        delayH:8.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Alternative Flight + Hotel',
        overrideRationale:'Overnight business delay — hotel and priority rebook confirmed' }),

    // ══════════════════════════════════════════════════════════════════════
    // AY103 HEL→CDG — 20 passengers total (rows 5,6,7 above + 17 below)
    // ══════════════════════════════════════════════════════════════════════

    // Notification only (6 more on AY103)
    b({ uid:'A-CL6FH8', pnr:'CL6FH8', name:'Yuki Tanaka',
        cabin:'Economy', tier:'Basic', flight:'AY103', ticket:190,
        delayH:0.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-CM3NV2', pnr:'CM3NV2', name:'Antti Salo',
        cabin:'Economy', tier:'Basic', flight:'AY103', ticket:195,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CN7TX4', pnr:'CN7TX4', name:'Laura Virtanen',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:210,
        delayH:1.0, dtType:'DELAY', dtReason:'Weather', dtCause:'WEATHER',
        forceAutoProcessed:true }),
    b({ uid:'A-CP4YK9', pnr:'CP4YK9', name:'Markus Saarinen',
        cabin:'Economy', tier:'Basic', flight:'AY103', ticket:185,
        delayH:1.25, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-CR8WZ5', pnr:'CR8WZ5', name:'Elina Hakala',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:200,
        delayH:1.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CT2MH7', pnr:'CT2MH7', name:'Ville Leppänen',
        cabin:'Economy', tier:'Basic', flight:'AY103', ticket:192,
        delayH:0.75, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),

    // Meal voucher (4 on AY103)
    b({ uid:'A-CV6NP3', pnr:'CV6NP3', name:'Priya Sharma',
        cabin:'Premium Economy', tier:'Gold', flight:'AY103', ticket:780,
        delayH:2.0, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CW9TK8', pnr:'CW9TK8', name:'James Richardson',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:250,
        delayH:2.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CX4VM2', pnr:'CX4VM2', name:'Meri Leinonen',
        cabin:'Economy', tier:'Gold', flight:'AY103', ticket:265,
        delayH:3.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-CZ7RB6', pnr:'CZ7RB6', name:'Nicolas Dubois',
        cabin:'Premium Economy', tier:'Silver', flight:'AY103', ticket:720,
        delayH:3.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // Lounge access (2 on AY103)
    b({ uid:'A-DB3PH4', pnr:'DB3PH4', name:'Amelia Foster',
        cabin:'Business', tier:'oneworld Emerald', flight:'AY103', ticket:2600,
        delayH:3.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-DC8WN7', pnr:'DC8WN7', name:'Christoph Bauer',
        cabin:'Business', tier:'Platinum', flight:'AY103', ticket:2400,
        delayH:4.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook same airline (2 on AY103 — 1 Agent, 1 AI)
    b({ uid:'A-DD5KT9', pnr:'DD5KT9', name:'Anu Korhonen',
        cabin:'Premium Economy', tier:'Gold', flight:'AY103', ticket:850,
        delayH:4.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Same Metal Recovery',
        overrideRationale:'Agent confirmed rebook after long crew delay' }),
    b({ uid:'A-DF2YX6', pnr:'DF2YX6', name:'Pierre Martin',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:280,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook partner (1 on AY103 — Agent Assisted)
    b({ uid:'A-DG9BV3', pnr:'DG9BV3', name:'Katariina Seppälä',
        cabin:'Business', tier:'Gold', flight:'AY103', ticket:2200,
        delayH:6.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Partner Metal Recovery',
        overrideRationale:'Gold member — partner airline rebook arranged by agent' }),

    // Hotel overnight (1 on AY103 — Agent Assisted)
    b({ uid:'A-DH4WK7', pnr:'DH4WK7', name:'Susanna Lind',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:260,
        delayH:9.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Alternative Flight + Hotel',
        overrideRationale:'Extended overnight delay — hotel and next-day rebook arranged' }),

    // ══════════════════════════════════════════════════════════════════════
    // AY131 HEL→SIN — 21 passengers total (row 8 above + 20 below)
    // ══════════════════════════════════════════════════════════════════════

    // Notification only (7 on AY131)
    b({ uid:'A-DJ6NT2', pnr:'DJ6NT2', name:'Oliver Müller',
        cabin:'Economy', tier:'Basic', flight:'AY131', ticket:420,
        delayH:0.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-DK3MX8', pnr:'DK3MX8', name:'Aisha Nkosi',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:435,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-DL9VZ4', pnr:'DL9VZ4', name:'Pekka Heinonen',
        cabin:'Economy', tier:'Basic', flight:'AY131', ticket:410,
        delayH:1.0, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-DM5TH6', pnr:'DM5TH6', name:'Wang Fang',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:440,
        delayH:1.25, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-DN2YK9', pnr:'DN2YK9', name:'Tiina Heikkinen',
        cabin:'Economy', tier:'Basic', flight:'AY131', ticket:425,
        delayH:1.5, dtType:'DELAY', dtReason:'Weather', dtCause:'WEATHER',
        forceAutoProcessed:true }),
    b({ uid:'A-DP7WN3', pnr:'DP7WN3', name:'Juhani Rantanen',
        cabin:'Economy', tier:'Basic', flight:'AY131', ticket:415,
        delayH:0.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-DR4BT7', pnr:'DR4BT7', name:'Seija Laaksonen',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:430,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Meal voucher (4 on AY131)
    b({ uid:'A-DT8KH2', pnr:'DT8KH2', name:'Elisa Fontaine',
        cabin:'Premium Economy', tier:'Gold', flight:'AY131', ticket:980,
        delayH:2.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-DV3PX6', pnr:'DV3PX6', name:'Chen Wei',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:450,
        delayH:2.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-DW9YN4', pnr:'DW9YN4', name:'Aleksandra Novak',
        cabin:'Economy', tier:'Gold', flight:'AY131', ticket:460,
        delayH:3.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-DX5MK8', pnr:'DX5MK8', name:'Tarmo Kallio',
        cabin:'Premium Economy', tier:'Silver', flight:'AY131', ticket:920,
        delayH:3.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Lounge access (3 on AY131)
    b({ uid:'A-DZ2HV6', pnr:'DZ2HV6', name:'Rodrigo Oliveira',
        cabin:'Business', tier:'Platinum', flight:'AY131', ticket:3100,
        delayH:4.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EB7NW3', pnr:'EB7NW3', name:'Mei-Ling Zhou',
        cabin:'Business', tier:'Gold', flight:'AY131', ticket:2800,
        delayH:4.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EC4TY9', pnr:'EC4TY9', name:'Leena Pitkänen',
        cabin:'First', tier:'Platinum', flight:'AY131', ticket:4500,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook same airline (3 on AY131 — 1 Agent, 2 AI)
    b({ uid:'A-ED8KZ5', pnr:'ED8KZ5', name:'Anders Kristiansen',
        cabin:'Business', tier:'Platinum', flight:'AY131', ticket:3200,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Same Metal Recovery',
        overrideRationale:'Platinum member — same-airline rebook confirmed by agent' }),
    b({ uid:'A-EF3VH7', pnr:'EF3VH7', name:'Malia Fonoti',
        cabin:'Premium Economy', tier:'Gold', flight:'AY131', ticket:1050,
        delayH:5.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EG9PN2', pnr:'EG9PN2', name:'Tuulia Häkkinen',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:440,
        delayH:6.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook partner (2 on AY131 — 1 Agent, 1 AI)
    b({ uid:'A-EH5BW4', pnr:'EH5BW4', name:'Sanna Virtanen',
        cabin:'Business', tier:'oneworld Emerald', flight:'AY131', ticket:3900,
        delayH:7.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Partner Metal Recovery',
        overrideRationale:'Emerald member on long-haul — partner airline fast-tracked' }),
    b({ uid:'A-EJ2TK8', pnr:'EJ2TK8', name:'Diego Fernández',
        cabin:'Business', tier:'Gold', flight:'AY131', ticket:2950,
        delayH:7.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Hotel overnight (1 on AY131 — Agent Assisted)
    b({ uid:'A-EK7YN5', pnr:'EK7YN5', name:'Liisa Koskela',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:450,
        delayH:8.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Alternative Flight + Hotel',
        overrideRationale:'Extended long-haul overnight delay — hotel and next-day rebook arranged' }),

    // ══════════════════════════════════════════════════════════════════════
    // AY73 HEL→NRT — 20 passengers total (row 1 above + 19 below)
    // ══════════════════════════════════════════════════════════════════════

    // Notification only (5 on AY73)
    b({ uid:'A-EL4MX9', pnr:'EL4MX9', name:'Kenji Nakamura',
        cabin:'Economy', tier:'Basic', flight:'AY73', ticket:400,
        delayH:0.5, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-EM8HZ3', pnr:'EM8HZ3', name:'Bianca Rossi',
        cabin:'Economy', tier:'Silver', flight:'AY73', ticket:415,
        delayH:0.75, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EN3VT7', pnr:'EN3VT7', name:'Tanaka Hiroshi',
        cabin:'Economy', tier:'Basic', flight:'AY73', ticket:405,
        delayH:1.0, dtType:'DELAY', dtReason:'ATC', dtCause:'ATC',
        forceAutoProcessed:true }),
    b({ uid:'A-EP6KW2', pnr:'EP6KW2', name:'Aino Mäkinen',
        cabin:'Economy', tier:'Silver', flight:'AY73', ticket:420,
        delayH:1.25, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-ER9PH5', pnr:'ER9PH5', name:'Olli Nieminen',
        cabin:'Economy', tier:'Basic', flight:'AY73', ticket:410,
        delayH:1.5, dtType:'DELAY', dtReason:'Weather', dtCause:'WEATHER',
        forceAutoProcessed:true }),

    // Meal voucher (4 on AY73)
    b({ uid:'A-ET4NX8', pnr:'ET4NX8', name:'Yuki Sato',
        cabin:'Economy', tier:'Silver', flight:'AY73', ticket:430,
        delayH:2.0, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EV7BK3', pnr:'EV7BK3', name:'Maria Johansson',
        cabin:'Premium Economy', tier:'Gold', flight:'AY73', ticket:1100,
        delayH:2.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EW2TY6', pnr:'EW2TY6', name:'Henrik Svensson',
        cabin:'Economy', tier:'Basic', flight:'AY73', ticket:415,
        delayH:3.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-EX5MH9', pnr:'EX5MH9', name:'Katja Berg',
        cabin:'Premium Economy', tier:'Silver', flight:'AY73', ticket:990,
        delayH:3.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // Lounge access (3 on AY73)
    b({ uid:'A-EZ8VW4', pnr:'EZ8VW4', name:'Riku Heikkinen',
        cabin:'Business', tier:'Gold', flight:'AY73', ticket:2900,
        delayH:4.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-FB3NT7', pnr:'FB3NT7', name:'Victoria Novak',
        cabin:'First', tier:'oneworld Emerald', flight:'AY73', ticket:5400,
        delayH:4.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-FC9KZ2', pnr:'FC9KZ2', name:'Laila Hassan',
        cabin:'Business', tier:'Platinum', flight:'AY73', ticket:3000,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook same airline (3 on AY73 — 1 Agent, 2 AI)
    b({ uid:'A-FD4WX6', pnr:'FD4WX6', name:'Karoliina Järvi',
        cabin:'Premium Economy', tier:'Gold', flight:'AY73', ticket:1200,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Same Metal Recovery',
        overrideRationale:'Agent arranged same-airline rebook for long-haul delay' }),
    b({ uid:'A-FE7HN3', pnr:'FE7HN3', name:'Thomas Laurent',
        cabin:'Business', tier:'Platinum', flight:'AY73', ticket:3400,
        delayH:5.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),
    b({ uid:'A-FF2YP8', pnr:'FF2YP8', name:'Yoko Watanabe',
        cabin:'Premium Economy', tier:'Silver', flight:'AY73', ticket:1050,
        delayH:6.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true }),

    // Rebook partner (3 on AY73 — 2 Agent, 1 AI)
    b({ uid:'A-FG5TK9', pnr:'FG5TK9', name:'Abdullah Hassan',
        cabin:'Business', tier:'oneworld Emerald', flight:'AY73', ticket:3800,
        delayH:7.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Partner Metal Recovery',
        overrideRationale:'Top-tier member on long-haul — partner airline priority rebook' }),
    b({ uid:'A-FH9BW5', pnr:'FH9BW5', name:'Pinja Saari',
        cabin:'Business', tier:'Gold', flight:'AY73', ticket:2850,
        delayH:7.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forceAutoProcessed:true,
        overrideAction:'Partner Metal Recovery',
        overrideRationale:'Gold member long-haul delay — partner airline arranged by agent' }),
    b({ uid:'A-FJ4VN2', pnr:'FJ4VN2', name:'Nikolai Petrov',
        cabin:'Business', tier:'Platinum', flight:'AY73', ticket:3100,
        delayH:8.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true }),

    // Hotel overnight (2 on AY73 — both Agent Assisted)
    b({ uid:'A-FK8WT6', pnr:'FK8WT6', name:'Kaisa Mäkinen',
        cabin:'Economy', tier:'Silver', flight:'AY73', ticket:420,
        delayH:9.0, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Alternative Flight + Hotel',
        overrideRationale:'Overnight stranding on long-haul — hotel and next-day rebook arranged' }),
    b({ uid:'A-FL3HX9', pnr:'FL3HX9', name:'Marco Bianchi',
        cabin:'First', tier:'Platinum', flight:'AY73', ticket:4800,
        delayH:9.5, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forceAutoProcessed:true,
        overrideAction:'Alternative Flight + Hotel',
        overrideRationale:'First class overnight delay — hotel suite and first available morning rebook' }),

    // ══════════════════════════════════════════════════════════════════════
    // GROUP B — 12 ACTIVE (pending_triage)
    //
    // Tier distribution (with tightened getQueueTier rules):
    //   URGENT   × 2  — escalated passengers
    //   PRIORITY × 2  — WCHR SSR  |  Platinum/Emerald long-haul cancelled
    //   MONITOR  × 2  — connection at risk
    //   STANDARD × 6  — everything else
    //
    // STANDARD GROUP PAIRS
    // GRP2KL: Family of 2 — Gold/Business + Basic/Economy (AY836, 4h Crew)
    //   Gold alone does NOT reach PRIORITY under new rules → STANDARD
    // GRP3MN: Couple — 2× Silver/Economy (AY103, 2.5h Technical)
    //   No connection, no SSR → STANDARD
    // ══════════════════════════════════════════════════════════════════════

    // ── STANDARD: MK7TLV — Family of 2 on AY836 ─────────────────────────
    b({ uid:'B-MK7TLV-1', pnr:'MK7TLV',
        name:'Aleksi Mäkinen',
        cabin:'Business', tier:'Gold', flight:'AY836', ticket:1950,
        delayH:4.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forcePending: true }),

    b({ uid:'B-MK7TLV-2', pnr:'MK7TLV',
        name:'Maija Mäkinen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:220,
        delayH:4.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forcePending: true }),

    // ── STANDARD: RX4WPB — Couple on AY103 (no connection) ──────────────
    b({ uid:'B-RX4WPB-1', pnr:'RX4WPB',
        name:'Tommi Leinonen',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:260,
        delayH:2.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forcePending: true }),

    b({ uid:'B-RX4WPB-2', pnr:'RX4WPB',
        name:'Hanna Leinonen',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:260,
        delayH:2.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forcePending: true }),

    // ── STANDARD: Individual short delays ────────────────────────────────
    b({ uid:'B-HG72SK', pnr:'HG72SK',
        name:'Jussi Heikkinen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:185,
        delayH:2.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        forcePending: true }),

    b({ uid:'B-LM5VCR', pnr:'LM5VCR',
        name:'Riina Salonen',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:240,
        delayH:3.33, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        forcePending: true }),

    // ── PRIORITY: WCHR — Matti Virtanen, AY131 long-haul 320min ─────────
    b({ uid:'B-TP8DXN', pnr:'TP8DXN',
        name:'Matti Virtanen',
        cabin:'Economy', tier:'Silver', flight:'AY131', ticket:430,
        delayH:5.33, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        ssr:'WCHR',
        forcePending: true }),

    // ── PRIORITY: Emerald/Cancelled — Kaisa Mäkinen, AY73 NRT cancelled ─
    b({ uid:'B-ZW3NPA', pnr:'ZW3NPA',
        name:'Kaisa Mäkinen',
        cabin:'First', tier:'oneworld Emerald', flight:'AY73', ticket:5200,
        delayH:8.0, dtType:'CANCELLATION', dtReason:'Technical', dtCause:'TECHNICAL',
        forcePending: true }),

    // ── MONITOR: Connection at risk — Pekka Korhonen, AY836 210min ───────
    b({ uid:'B-K7RX2M', pnr:'K7RX2M',
        name:'Pekka Korhonen',
        cabin:'Business', tier:'Gold', flight:'AY836', ticket:1850,
        delayH:3.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        hasCon: true, conBuf: 35,
        forcePending: true }),

    // ── MONITOR: Connection at risk — Tuula Nieminen, AY103 190min ───────
    b({ uid:'B-BF94TL', pnr:'BF94TL',
        name:'Tuula Nieminen',
        cabin:'Economy', tier:'Silver', flight:'AY103', ticket:255,
        delayH:3.17, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        hasCon: true, conBuf: 40,
        forcePending: true }),

    // ESCALATED — Elena Karpova, critical board meeting concern
    b({ uid:'B-NV7PWK', pnr:'NV7PWK',
        name:'Elena Karpova',
        cabin:'Business', tier:'Gold', flight:'AY131', ticket:2350,
        delayH:6.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        escalated: true,
        escalationReason: 'Anxious about missing critical board meeting in Singapore — needs earliest alternative routing.',
        handoffBriefing: {
          summary: 'Business class Gold passenger on AY131 to Singapore, facing a 6-hour crew scheduling delay. She has a critical board meeting on arrival and escalated after discussing her concern through the passenger chat.',
          passengerConcern: 'Missing a critical board meeting in Singapore — needs the earliest possible alternative routing, even via connection.',
          emotionalState: 'Anxious',
          urgencyLevel: 'High',
          whatWasArranged: ['Lounge access confirmed', 'Priority rebooking assessment in progress'],
          suggestedOpeningLine: 'Ms. Karpova, I\'m here personally about your AY131 delay — I completely understand the importance of your Singapore meeting, and I\'ve already pulled up every available alternative routing for you.',
          sensitiveIssues: ['High-value Gold passenger', 'Critical business commitment — meeting cannot be rescheduled', 'Any rerouting via BKK or KUL may be acceptable'],
          recommendedAction: 'Rebook on earliest partner airline connection to SIN via any hub — explore QR, EK, TG routes immediately',
          estimatedResolutionTime: '10 mins',
          generatedAt: new Date().toISOString(),
          passengerPnr: 'NV7PWK',
          conversationLength: 4,
          keyDetails: [
            'Critical board meeting in Singapore',
            'Needs earliest possible alternative routing',
            'Open to connections via any hub',
            'Gold member — priority handling required',
          ],
        } }),

    // ESCALATED — Jari Nyman, infant + bassinet concern
    b({ uid:'B-PX5HWN', pnr:'PX5HWN',
        name:'Jari Nyman',
        cabin:'Economy', tier:'Silver', flight:'AY73', ticket:420,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        hasInf: true,
        escalated: true,
        escalationReason: 'Worried about infant care — needs bassinet seat confirmed on any rebooked flight to Tokyo.',
        handoffBriefing: {
          summary: 'Economy Silver passenger travelling with an infant on AY73 to Tokyo. A 5-hour technical delay has left him concerned about overnight infant care and whether his bassinet reservation will carry over to a rebooked flight.',
          passengerConcern: 'Needs confirmation that bassinet seat is secured on any rebooked flight — the infant cannot travel long-haul without it.',
          emotionalState: 'Frustrated',
          urgencyLevel: 'High',
          whatWasArranged: ['Meal voucher issued', 'Hotel accommodation assessed for overnight'],
          suggestedOpeningLine: 'Mr. Nyman, I\'m here about your AY73 delay — I understand you\'re travelling with your little one and I want to make sure both of you are taken care of tonight and on any new flight.',
          sensitiveIssues: ['Travelling with infant — bassinet/BSCT seat is mandatory', 'Any rebook must confirm BSCT allocation before issuing boarding pass'],
          recommendedAction: 'Book on next AY73 departure with confirmed bassinet; arrange hotel for overnight with cot if needed',
          estimatedResolutionTime: '15 mins',
          generatedAt: new Date().toISOString(),
          passengerPnr: 'PX5HWN',
          conversationLength: 3,
          keyDetails: [
            'Travelling with infant under 12 months',
            'Requires bassinet/cot at hotel',
            'Partner travelling on same PNR',
            'Needs family-friendly accommodation',
          ],
        } }),

    // ══════════════════════════════════════════════════════════════════════
    // GROUP C — 5 PASSENGER PORTAL DEMO
    // Varied chatState for showcasing the WhatsApp/portal experience
    // ══════════════════════════════════════════════════════════════════════

    // C1: Simple delay — info only view
    b({ uid:'C-JT4NVW', pnr:'JT4NVW',
        name:'Pekka Virtanen',
        cabin:'Economy', tier:'Silver', flight:'AY836', ticket:230,
        delayH:1.5, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        chatStateOverride: 'info_only',
        forcePending: true,
        portalOnly: true }),

    // C2: Meal voucher ready
    b({ uid:'C-KP8BXZ', pnr:'KP8BXZ',
        name:'Anna Koskinen',
        cabin:'Economy', tier:'Basic', flight:'AY103', ticket:200,
        delayH:2.5, dtType:'DELAY', dtReason:'Late Inbound', dtCause:'OPERATIONAL',
        chatStateOverride: 'voucher',
        forcePending: true,
        portalOnly: true }),

    // C3: Rebook plan sent — Business class
    b({ uid:'C-NW6HYT', pnr:'NW6HYT',
        name:'Ville Heikkinen',
        cabin:'Business', tier:'Gold', flight:'AY131', ticket:2200,
        delayH:6.0, dtType:'DELAY', dtReason:'Crew Scheduling', dtCause:'OPERATIONAL',
        chatStateOverride: 'plan_sent',
        forcePending: true,
        portalOnly: true }),

    // C4: Hotel + rebook plan sent
    b({ uid:'C-RV3KMP', pnr:'RV3KMP',
        name:'Marika Lähteinen',
        cabin:'Economy', tier:'Silver', flight:'AY73', ticket:430,
        delayH:5.0, dtType:'DELAY', dtReason:'Technical', dtCause:'TECHNICAL',
        chatStateOverride: 'plan_sent',
        forcePending: true,
        portalOnly: true }),

    // C5: Cancellation — initial state (for full demo flow)
    b({ uid:'C-TH7YWB', pnr:'TH7YWB',
        name:'Jouni Korhonen',
        cabin:'Economy', tier:'Basic', flight:'AY836', ticket:195,
        delayH:4.0, dtType:'CANCELLATION', dtReason:'Weather', dtCause:'WEATHER',
        chatStateOverride: 'initial',
        forcePending: true,
        portalOnly: true }),

  ];

  // ─── Pre-compute rule engine baseline for ALL passengers ──────────────────
  // Zero Claude API calls on page load — all analysis is pre-computed
  const analysisCache: Record<string, AnalysisResult> = {};
  for (const p of passengers) {
    analysisCache[p.uid] = computeRuleEngineBaseline(p);
  }

  // ─── Group A: override recommendedAction to match intended action type ─────
  // The engine only natively produces Notification Only and Meal Voucher for
  // short/medium delays. Lounge, Rebook Same, Partner, and Hotel actions must
  // be injected here so the Audit Review Final Action column renders correctly.
  //
  // Agent Assisted passengers already have overrideAction set on the Passenger
  // object (used by the Audit Review resolution mode badge). We also set
  // analysisCache.recommendedAction so the "Recommended Action" is consistent.
  //
  const analysisCacheOverrides: Record<string, ActionType> = {
    // ── Lounge access (AI Resolved — no overrideAction on passenger) ──────
    'A-AD5PX9': 'Original Flight Maintained + Lounge Access Issued',  // AY836 Gold/Business 3h
    'A-CD5MX7': 'Original Flight Maintained + Lounge Access Issued',  // AY836 Platinum/Business 4h
    'A-CF2HT4': 'Original Flight Maintained + Lounge Access Issued',  // AY836 Platinum/First 4.5h
    'A-DB3PH4': 'Original Flight Maintained + Lounge Access Issued',  // AY103 OW Emerald/Business 3.5h
    'A-DC8WN7': 'Original Flight Maintained + Lounge Access Issued',  // AY103 Platinum/Business 4h
    'A-DZ2HV6': 'Original Flight Maintained + Lounge Access Issued',  // AY131 Platinum/Business 4h
    'A-EB7NW3': 'Original Flight Maintained + Lounge Access Issued',  // AY131 Gold/Business 4.5h
    'A-EC4TY9': 'Original Flight Maintained + Lounge Access Issued',  // AY131 Platinum/First 5h
    'A-EZ8VW4': 'Original Flight Maintained + Lounge Access Issued',  // AY73 Gold/Business 4h
    'A-FB3NT7': 'Original Flight Maintained + Lounge Access Issued',  // AY73 OW Emerald/First 4.5h
    'A-FC9KZ2': 'Original Flight Maintained + Lounge Access Issued',  // AY73 Platinum/Business 5h

    // ── Rebook same airline (AI Resolved) ────────────────────────────────
    'A-CH4VN9': 'Same Metal Recovery',  // AY836 Silver/PremEco 5.5h
    'A-DF2YX6': 'Same Metal Recovery',  // AY103 Silver/Economy 5h
    'A-EF3VH7': 'Same Metal Recovery',  // AY131 Gold/PremEco 5.5h
    'A-EG9PN2': 'Same Metal Recovery',  // AY131 Silver/Economy 6h
    'A-FE7HN3': 'Same Metal Recovery',  // AY73 Platinum/Business 5.5h
    'A-FF2YP8': 'Same Metal Recovery',  // AY73 Silver/PremEco 6h
    'A-FJ4VN2': 'Same Metal Recovery',  // AY73 Platinum/Business 8h (partner AI)
    'A-EJ2TK8': 'Partner Metal Recovery',  // AY131 Gold/Business 7.5h (partner AI)
    'A-AH6RM4': 'Partner Metal Recovery',  // AY131 OW Emerald/First 7.5h (partner AI row 8)

    // ── Rebook same airline (Agent Assisted — align cache with overrideAction) ─
    'A-AF4YG8': 'Same Metal Recovery',  // AY103 Silver/PremEco 5h
    'A-CG8YP6': 'Same Metal Recovery',  // AY836 Gold/PremEco 5h
    'A-DD5KT9': 'Same Metal Recovery',  // AY103 Gold/PremEco 4.5h
    'A-ED8KZ5': 'Same Metal Recovery',  // AY131 Platinum/Business 5h
    'A-FD4WX6': 'Same Metal Recovery',  // AY73 Gold/PremEco 5h

    // ── Partner rebook (Agent Assisted — align cache with overrideAction) ────
    'A-AA3R7M': 'Partner Metal Recovery',  // AY73 Gold/Business 7h
    'A-CJ7KW3': 'Partner Metal Recovery',  // AY836 Gold/Business 7h
    'A-DG9BV3': 'Partner Metal Recovery',  // AY103 Gold/Business 6.5h
    'A-EH5BW4': 'Partner Metal Recovery',  // AY131 OW Emerald/Business 7h
    'A-FG5TK9': 'Partner Metal Recovery',  // AY73 OW Emerald/Business 7h
    'A-FH9BW5': 'Partner Metal Recovery',  // AY73 Gold/Business 7.5h

    // ── Hotel overnight (Agent Assisted — align cache with overrideAction) ───
    'A-AC2NF6': 'Alternative Flight + Hotel',  // AY836 Platinum/Business 9h
    'A-CK2BT5': 'Alternative Flight + Hotel',  // AY836 Platinum/Business 8.5h
    'A-DH4WK7': 'Alternative Flight + Hotel',  // AY103 Silver/Economy 9h
    'A-EK7YN5': 'Alternative Flight + Hotel',  // AY131 Silver/Economy 8.5h
    'A-FK8WT6': 'Alternative Flight + Hotel',  // AY73 Silver/Economy 9h
    'A-FL3HX9': 'Alternative Flight + Hotel',  // AY73 Platinum/First 9.5h
  };

  for (const [uid, action] of Object.entries(analysisCacheOverrides)) {
    if (analysisCache[uid]) {
      analysisCache[uid] = { ...analysisCache[uid], recommendedAction: action };
    }
  }

  return { passengers, analysisCache };
}
