import {
  Passenger,
  CabinClass,
  LoyaltyTier,
  SSRCode,
  Jurisdiction,
  DisruptionReason,
  HaulType,
  TimingType,
  PaxStatus,
  ChatMessage,
} from './types';
import { addHours, formatISO } from 'date-fns';
import { computeEngine } from './engine';

const SCENARIOS = [
  {
    flightNumber: 'AY15',
    route: 'HEL-JFK',
    reason: 'Technical Delay',
    type: 'Technical' as DisruptionReason,
    delay: 14,
    haul: 'Long' as HaulType,
    timing: 'Overnight' as TimingType,
    jurisdiction: 'EU' as Jurisdiction,
    baseComp: 600,
  },
  {
    flightNumber: 'AY131',
    route: 'HEL-SIN',
    reason: 'Crew Sickness',
    type: 'Crew Scheduling' as DisruptionReason,
    delay: 26,
    haul: 'Long' as HaulType,
    timing: 'Overnight' as TimingType,
    jurisdiction: 'EU' as Jurisdiction,
    baseComp: 600,
  },
  {
    flightNumber: 'AY101',
    route: 'HEL-ORD',
    reason: 'Hydraulic Leak',
    type: 'Technical' as DisruptionReason,
    delay: 18,
    haul: 'Long' as HaulType,
    timing: 'Overnight' as TimingType,
    jurisdiction: 'US' as Jurisdiction,
    baseComp: 600,
  },
  {
    flightNumber: 'AY141',
    route: 'HEL-BKK',
    reason: 'Late Incoming CDG',
    type: 'Late Inbound' as DisruptionReason,
    delay: 8,
    haul: 'Long' as HaulType,
    timing: 'Overnight' as TimingType,
    jurisdiction: 'EU' as Jurisdiction,
    baseComp: 600,
  },
  {
    flightNumber: 'AY73',
    route: 'HEL-NRT',
    reason: 'Engine Maintenance',
    type: 'Technical' as DisruptionReason,
    delay: 20,
    haul: 'Long' as HaulType,
    timing: 'Overnight' as TimingType,
    jurisdiction: 'EU' as Jurisdiction,
    baseComp: 600,
  },
];

const CABIN_WEIGHTS: { type: CabinClass; weight: number }[] = [
  { type: 'Economy', weight: 0.5 },
  { type: 'Premium Economy', weight: 0.2 },
  { type: 'Business', weight: 0.3 },
];

const TIER_WEIGHTS: { type: LoyaltyTier; weight: number }[] = [
  { type: 'Basic', weight: 0.4 },
  { type: 'Silver', weight: 0.2 },
  { type: 'Gold', weight: 0.15 },
  { type: 'Platinum', weight: 0.1 },
  { type: 'oneworld Emerald', weight: 0.1 },
  { type: 'Platinum Lumo', weight: 0.05 },
];

const NAMES = [
  'Pekka Virtanen',
  'Minna Korhonen',
  'Juhani Mäkinen',
  'Tuula Nieminen',
  'Antti Laine',
  'Sari Heikkilä',
  'Mikko Koskinen',
  'Pirjo Järvinen',
  'Seppo Lehtonen',
  'Ritva Hämäläinen',
  'Matti Peltonen',
  'Liisa Salonen',
  'Kari Haapala',
  'Eeva Turunen',
  'Ville Rantanen',
  'Anne Karjalainen',
  'Juha Jokinen',
  'Päivi Lahtinen',
  'Timo Ahonen',
  'Satu Mustonen',
];

function weightedRandom<T>(items: { type: T; weight: number }[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    if (random < item.weight) return item.type;
    random -= item.weight;
  }
  return items[0].type;
}

function generatePNR() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generateSeedData(): Passenger[] {
  const passengers: Passenger[] = [];
  const now = new Date();
  const usedPNRs = new Set<string>();

  const SCENARIO_DISTRIBUTION = [
    { type: 'Info Only', weight: 0.45, delayRange: [0.5, 1.4] },
    { type: 'Delay + Voucher', weight: 0.25, delayRange: [1.5, 4.9] },
    { type: 'Alternative Flight', weight: 0.18, delayRange: [5, 12] },
    { type: 'Alternative Flight + Hotel', weight: 0.08, delayRange: [8, 24] },
    { type: 'Priority / Concierge', weight: 0.03, delayRange: [2, 26] },
    { type: 'Special Cases', weight: 0.01, delayRange: [5, 24] },
  ];

  while (passengers.length < 50) {
    const scenarioType = weightedRandom(
      SCENARIO_DISTRIBUTION.map((s) => ({ type: s, weight: s.weight }))
    );
    const delay =
      scenarioType.delayRange[0] +
      Math.random() * (scenarioType.delayRange[1] - scenarioType.delayRange[0]);

    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    const partySize = Math.max(
      1,
      Math.floor(Math.random() * 5 + 1)
    );

    const actualSize = Math.min(partySize, 50 - passengers.length);
    if (actualSize <= 0) break;

    let pnr = generatePNR();
    while (usedPNRs.has(pnr)) pnr = generatePNR();
    usedPNRs.add(pnr);

    for (let i = 0; i < actualSize; i++) {
      let cabin = weightedRandom(CABIN_WEIGHTS);
      let tier = weightedRandom(TIER_WEIGHTS);
      let ssrCode: SSRCode = '';
      let isEscalated = false;
      let uiStatus: PaxStatus = 'auto_processed';

      // Distribute test cases: 85% auto_processed, 10% pending_triage, 5% escalated
      const testRoll = Math.random();
      const passengerIndex = passengers.length + i;

      if (scenarioType.type === 'Priority / Concierge') {
        tier = Math.random() > 0.5 ? 'Platinum Lumo' : 'Platinum';
        cabin = 'Business';
        uiStatus = 'pending_triage';
      } else if (scenarioType.type === 'Special Cases') {
        ssrCode = Math.random() > 0.5 ? 'UMNR' : 'WCHR';
        uiStatus = 'pending_triage';
      } else if (
        scenarioType.type === 'Alternative Flight' ||
        scenarioType.type === 'Alternative Flight + Hotel'
      ) {
        uiStatus = Math.random() > 0.4 ? 'auto_processed' : 'pending_triage';
      } else {
        // For other scenarios, apply test case distribution
        if (testRoll < 0.05) {
          // 5% - Escalated cases (complex situations)
          isEscalated = true;
          uiStatus = 'pending_triage';
          if (Math.random() > 0.5) {
            ssrCode = Math.random() > 0.5 ? 'UMNR' : 'WCHR';
          }
        } else if (testRoll < 0.15) {
          // 10% - Pending triage (high value customers, long delays, etc.)
          uiStatus = 'pending_triage';
          if (Math.random() > 0.6) {
            tier = Math.random() > 0.5 ? 'Platinum Lumo' : 'Platinum';
          }
        }
        // else: 85% remain as auto_processed
      }

      const ticketValue =
        scenario.haul === 'Long'
          ? 400 + Math.random() * 400
          : 100 + Math.random() * 150;
      const hotelCost = 150 + Math.random() * 100;
      const oalCost = ticketValue * (0.6 + Math.random() * 0.8);

      const schedDep = addHours(now, 2);
      const schedArr = addHours(
        schedDep,
        scenario.haul === 'Long' ? 8 : 1.5
      );
      const estArr = addHours(schedArr, delay);

      let internalSeatAvailable = true;
      let partnerSeatAvailable = true;
      let inventoryConfidenceScore = 0.9;

      if (
        scenarioType.type === 'Alternative Flight' ||
        scenarioType.type === 'Alternative Flight + Hotel'
      ) {
        internalSeatAvailable = Math.random() > 0.3;
        partnerSeatAvailable = Math.random() > 0.2;
      }

      // Determine disruption type and cause
      const disruptionTypeWeights = [
        { type: 'DELAY' as const, weight: 0.85 },
        { type: 'CANCELLATION' as const, weight: 0.15 },
      ];
      const disruptionType = weightedRandom(disruptionTypeWeights);

      const disruptionCauseWeights = [
        { type: 'TECHNICAL' as const, weight: 0.25 },
        { type: 'OPERATIONAL' as const, weight: 0.2 },
        { type: 'WEATHER' as const, weight: 0.25 },
        { type: 'ATC' as const, weight: 0.15 },
        { type: 'SECURITY' as const, weight: 0.05 },
        { type: 'STRIKE_AIRLINE' as const, weight: 0.05 },
        { type: 'STRIKE_EXTERNAL' as const, weight: 0.05 },
      ];
      const disruptionCause = weightedRandom(disruptionCauseWeights);

      // Determine carrier size
      const carrierSizeWeights = [
        { type: 'large' as const, weight: 0.7 },
        { type: 'small' as const, weight: 0.3 },
      ];
      const carrierSize = weightedRandom(carrierSizeWeights);

      // Determine connection and infant status
      const hasConnection = Math.random() > 0.7;
      const connectionBufferMinutes = hasConnection
        ? 60 + Math.floor(Math.random() * 180)
        : undefined;
      const hasInfant = Math.random() > 0.95;

      // Determine rebook status
      const rebookStatusWeights = [
        { type: 'pending' as const, weight: 0.4 },
        { type: 'confirmed' as const, weight: 0.35 },
        { type: 'declined' as const, weight: 0.15 },
        { type: 'waitlisted' as const, weight: 0.1 },
      ];
      const rebookStatus = weightedRandom(rebookStatusWeights);

      const basePax: Passenger = {
        uid: pnr + '-' + i,
        pnr,
        name: NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + (passengers.length + 1),
        cabin,
        tier,
        flightNumber: scenario.flightNumber,
        origin: scenario.route.split('-')[0],
        destination: scenario.route.split('-')[1],
        haul: scenario.haul,
        timing: scenario.timing,
        scheduledDeparture: formatISO(schedDep),
        scheduledArrival: formatISO(schedArr),
        estimatedArrival: formatISO(estArr),
        jurisdiction: scenario.jurisdiction,
        disruptionReason: scenario.type,
        delayHours: delay,
        delayMinutes: Math.round(delay * 60),
        ticketValue,
        hotelCost,
        oalCost,
        oalFlightNumber: 'DL' + (1000 + Math.floor(Math.random() * 9000)),
        baseEU261Comp: scenario.baseComp,
        internalSeatAvailable,
        partnerSeatAvailable,
        internalWaitHours: delay + (1 + Math.random() * 4),
        ssrCode,
        partySize: actualSize,
        travelPartySize: actualSize,
        carrierSize,
        hasConnection,
        connectionBufferMinutes,
        hasInfant,
        disruptionType,
        disruptionCause,
        rebookStatus,
        rebookConsentRequired: cabin === 'Business' && delay >= 5,
        downgradeOffered: cabin === 'Business' && delay >= 5,
        status: uiStatus,
        isEscalated,
        chatState: 'initial',
        messages: [],
        inventoryConfidenceScore,
      };

      const analysis = computeEngine(basePax);

      const isRebooked =
        analysis.liabilityEngine.itinerary.status === 'Rebooked';
      const isLounge = analysis.recommendedAction.includes('Lounge');
      const isMeal = analysis.recommendedAction.includes('Meal');
      const isCoffee =
        scenarioType.type === 'Delay + Voucher' && delay < 2;
      const newFlight = analysis.liabilityEngine.itinerary.newFlight;
      const delayText =
        delay >= 1
          ? `${Math.floor(delay)} hour${Math.floor(delay) > 1 ? 's' : ''}`
          : 'a short period';

      const initialMessages: ChatMessage[] = [
        {
          role: 'assistant',
          content: `Hyvää päivää, this is the Finnair Customer Care team. We sincerely apologize, but flight ${scenario.flightNumber} to ${scenario.route.split('-')[1]} has been disrupted due to ${
            [
              'Technical',
              'Crew Scheduling',
              'Late Inbound',
            ].includes(scenario.type)
              ? 'technical issues with the aircraft'
              : scenario.type.toLowerCase()
          }.`,
          timestamp: '10:41',
        },
      ];

      if (uiStatus === 'auto_processed') {
        if (isRebooked) {
          initialMessages.push({
            role: 'assistant',
            content: `We have arranged an alternative flight for you. You are now booked on flight ${newFlight} departing at ${analysis.liabilityEngine.itinerary.newETD}.`,
            timestamp: '10:41',
          });
          if (
            analysis.liabilityEngine.dutyOfCare.hotel.eligible
          ) {
            initialMessages.push({
              role: 'assistant',
              content: `As your delay is overnight, we have also arranged a hotel room at the ${analysis.liabilityEngine.dutyOfCare.hotel.provider}. Your boarding pass and vouchers are attached below.`,
              timestamp: '10:42',
            });
          } else {
            initialMessages.push({
              role: 'assistant',
              content: `Your new boarding pass and any applicable meal vouchers are attached below.`,
              timestamp: '10:42',
            });
          }
        } else if (isLounge) {
          initialMessages.push({
            role: 'assistant',
            content: `Your flight is currently delayed by approximately ${delayText}.`,
            timestamp: '10:41',
          });
          initialMessages.push({
            role: 'assistant',
            content: `As a valued Finnair Plus member, we have issued a digital lounge pass for the ${analysis.liabilityEngine.dutyOfCare.lounge?.name} for you to use while you wait.`,
            timestamp: '10:42',
          });
        } else if (isMeal || isCoffee) {
          initialMessages.push({
            role: 'assistant',
            content: `Your flight is currently delayed by approximately ${delayText}.`,
            timestamp: '10:41',
          });
          initialMessages.push({
            role: 'assistant',
            content: `We have issued a digital ${isCoffee ? 'coffee' : 'meal'} voucher for you to use at the airport. It can be redeemed at any participating outlet.`,
            timestamp: '10:42',
          });
        } else {
          initialMessages.push({
            role: 'assistant',
            content: `Your flight is currently delayed by approximately ${delayText}. We are monitoring the situation closely and will provide updates as they become available.`,
            timestamp: '10:41',
          });
        }
      } else {
        if (ssrCode !== '') {
          initialMessages.push({
            role: 'assistant',
            content: `Your flight is currently delayed. A gate agent will contact you with your recovery option soon.`,
            timestamp: '10:41',
          });
        } else {
          initialMessages.push({
            role: 'assistant',
            content: `We understand this is an inconvenience and our team is currently working on the best resolution for you. We will update you shortly.`,
            timestamp: '10:41',
          });
        }
      }

      let chatState: Passenger['chatState'] = 'initial';
      if (uiStatus === 'auto_processed') {
        if (isRebooked) chatState = 'plan_sent';
        else if (isLounge) chatState = 'info_only';
        else if (isMeal || isCoffee) chatState = 'voucher';
        else chatState = 'info_only';
      }

      passengers.push({
        ...basePax,
        chatState,
        messages: initialMessages,
      });
    }
  }

  return passengers;
}
