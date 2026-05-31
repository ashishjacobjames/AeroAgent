import {
  Passenger,
  AnalysisResult,
  CostBreakdown,
  ActionType,
  RecoveryOption,
  RecoveryPrimaryAction,
  WhatsappMessageType,
  WhatsAppMessage,
  HandoffBriefing,
  AuditNarrative,
} from './types';
import {
  MEAL_VOUCHER_RATE,
  OVERNIGHT_THRESHOLD_MINUTES,
  EU261_SHORT_HAUL_AMOUNT,
  EU261_MEDIUM_HAUL_AMOUNT,
  EU261_LONG_HAUL_AMOUNT,
  EU261_SHORT_MEDIUM_THRESHOLD,
  EU261_LONG_THRESHOLD,
  EU261_MEALS_SHORT_THRESHOLD,
  OAL_COST,
} from './constants';

// ============================================================================
// MOD 2: AUTO-PROCESSING LOGIC - MANAGED BY EXCEPTION
// ============================================================================
export const shouldAutoProcess = (pax: Passenger): boolean => {
  // Auto-process ONLY if ALL conditions met:
  return (
    pax.disruptionType === 'DELAY' &&
    (pax.delayMinutes ?? 0) < EU261_SHORT_MEDIUM_THRESHOLD &&
    // Note: priorityAssessment is computed in engine, so we check during seed/initial state
    // This will be validated when status is assigned in seed.ts
    !pax.ssrCode &&
    !pax.isEscalated
    // Note: overnight stranding (≥480 min) is already excluded by the
    // < EU261_SHORT_MEDIUM_THRESHOLD (180 min) guard above.
  );
};

// MOD 4: AI-POWERED ANALYSIS - uses computeEngineAI async function (defined below)
// ============================================================================
// BUG 4: CHURN PROPENSITY SCALED TO SEVERITY
// ============================================================================
function getChurnPropensity(
  delayMinutes: number,
  disruptionType: string,
  loyaltyTier: string,
  wasHandledWell: boolean = true
): number {
  // Base propensity by severity
  let base = 0;

  if (disruptionType === 'CANCELLATION') {
    base = 0.30;
  } else if (delayMinutes >= 1200) {
    // 20h+ — severe
    base = 0.35;
  } else if (delayMinutes >= 600) {
    // 10h+ — very significant
    base = 0.28;
  } else if (delayMinutes >= 300) {
    // 5h+
    base = 0.20;
  } else if (delayMinutes >= EU261_SHORT_MEDIUM_THRESHOLD) {
    // 3h+
    base = 0.12;
  } else if (delayMinutes >= 90) {
    // 90 mins+
    base = 0.05;
  } else {
    // Under 90 mins
    base = 0.01;
  }

  // Loyalty modifier
  // Loyal passengers forgive more
  if (loyaltyTier === 'Platinum') {
    base = base * 0.35;
  } else if (loyaltyTier === 'Gold') {
    base = base * 0.55;
  } else if (loyaltyTier === 'Silver') {
    base = base * 0.75;
  }
  // Basic/Standard/None: no modifier

  // Handling quality modifier
  if (wasHandledWell) {
    base = base * 0.6;
    // Proactive handling reduces churn
  } else {
    base = base * 1.4;
    // Poor handling amplifies churn
  }

  // Cap at realistic maximum
  return Math.min(base, 0.55);
}

// ============================================================================
// FIX 2: ACTION-GATED COST CALCULATION
// ============================================================================
function calculateAeroAgentCost(
  primaryAction: string,
  _ticketValue: number,
  _oalCost: number,
  hotelCost: number,
  _mealVoucherOffered: boolean,
  mealVoucherValue: number,
  dutyOfCareHotel: boolean,
  dutyOfCareMeals: boolean
): number {
  let totalCost = 0;

  // OAL rebook cost (€450) — ONLY if action is a partner/interline rebook
  if (
    primaryAction.includes('Partner Metal') ||
    primaryAction.includes('Interline Metal') ||
    primaryAction.includes('OAL') ||
    primaryAction === 'REBOOK_PARTNER' ||
    primaryAction === 'REBOOK_INTERLINE'
  ) {
    totalCost += OAL_COST;
  }

  // Hotel cost — ONLY if duty of care hotel is applicable
  if (dutyOfCareHotel) {
    totalCost += hotelCost;
  }

  // Meals (€20) — ONLY if duty of care meals is applicable
  // Note: mealVoucherOffered === dutyOfCareMeals — only one branch fires to avoid double-charging
  if (dutyOfCareMeals) {
    totalCost += mealVoucherValue || MEAL_VOUCHER_RATE;
  }

  // Lounge (€0) — operational sunk cost, not charged
  // Compensation — handled separately in regulatory calculation

  return Math.max(0.1, parseFloat(totalCost.toFixed(2))); // Minimum €0.10 for notification
}

// ============================================================================
// BUG 5: CALCULATE CLV BASED ON PASSENGER ATTRIBUTES
// ============================================================================
function calculateCLV(
  cabin: string,
  loyaltyTier: string,
  ticketValue: number,
  isInternational: boolean
): number {
  // Base annual flight frequency by tier
  let annualFlights = 0;

  if (loyaltyTier === 'Platinum') {
    annualFlights = 40;
  } else if (loyaltyTier === 'Gold') {
    annualFlights = 25;
  } else if (loyaltyTier === 'Silver') {
    annualFlights = 12;
  } else {
    // Basic / Standard / None
    annualFlights = 4;
  }

  // Average ticket value proxy
  // Use actual ticket value if available
  // Otherwise estimate by cabin
  let avgTicketValue = ticketValue > 0 ? ticketValue :
    cabin === 'F' ? 4500 :
    cabin === 'J' ? 2200 :
    cabin === 'W' ? 800 :
    350;

  // International premium
  const routeMultiplier = isInternational ? 1.3 : 1.0;

  // Assume 7-year customer lifetime
  const lifetimeYears = 7;

  // Margin assumption: 15%
  const marginRate = 0.15;

  const clv =
    annualFlights *
    avgTicketValue *
    routeMultiplier *
    lifetimeYears *
    marginRate;

  return Math.round(clv);
}

// ============================================================================
// BUG 6: LEGACY COST TOO LOW FOR SEVERE DISRUPTIONS
// ============================================================================
function calculateLegacyCost(
  _primaryAction: string,
  delayMinutes: number,
  disruptionType: string,
  jurisdiction: string,
  cabin: string,
  _loyaltyTier: string,
  ticketValue: number,
  isOvernightStranding: boolean
): number {
  let legacyCost = 0;

  // Notification cost — always
  legacyCost += 0.50;

  // Under 90 mins — legacy also just notifies, minimal cost
  if (delayMinutes < 90 && disruptionType !== 'CANCELLATION') {
    return legacyCost;
  }

  // Duty of care
  // Legacy over-applies — does not check thresholds correctly
  if (delayMinutes >= EU261_MEALS_SHORT_THRESHOLD) {
    legacyCost += 45;
    // Meals applied too broadly
  }

  if (
    isOvernightStranding ||
    disruptionType === 'CANCELLATION' ||
    delayMinutes >= 300
  ) {
    // Hotel — legacy applies without checking overnight properly
    legacyCost += 150;
  }

  // EU261 compensation
  // Legacy always pays €600 max
  // Does not check extraordinary circumstances
  if (jurisdiction === 'EU261' || jurisdiction === 'UK261') {
    if (delayMinutes >= EU261_SHORT_MEDIUM_THRESHOLD) {
      legacyCost += EU261_LONG_HAUL_AMOUNT;
      // Always maximum — not distance-based
      // Does not check Article 5(3)
    }
  }

  // US DOT
  if (
    jurisdiction === 'USDOT_DOMESTIC' ||
    jurisdiction === 'USDOT_INTERNATIONAL'
  ) {
    if (delayMinutes >= 360) {
      legacyCost += ticketValue * 0.5;
      // Proxy for fare refund
      // Legacy often refunds full fare
    }
  }

  // APPR
  if (jurisdiction === 'APPR_LARGE' || jurisdiction === 'APPR_SMALL') {
    if (delayMinutes >= EU261_SHORT_MEDIUM_THRESHOLD) {
      legacyCost += 700;
      // Legacy pays max APPR amount
    }
  }

  // OAL rebook
  // Legacy always tries to rebook on partner/interline
  // even when same metal is available
  if (disruptionType === 'CANCELLATION' || delayMinutes >= 300) {
    legacyCost += 550;
    // Legacy defaults to expensive partner rebook
    // without optimising
  }

  // Premium cabin over-service
  // Legacy agents apply ad-hoc gestures
  // inconsistently for premium pax
  if (cabin === 'F' || cabin === 'J') {
    legacyCost += 150;
  }

  return legacyCost;
}


interface WhatsappMessageClaudeResponse {
  message: string;
  messageType: string;
  tone: 'neutral' | 'apologetic' | 'empathetic' | 'urgent';
  includedElements: string[];
  qrCodeRequired: boolean;
  qrCodeType: 'voucher' | 'lounge' | 'ticket' | null;
}

function generateTemplateMessage(
  pax: Passenger,
  result: AnalysisResult
): WhatsAppMessage {
  const timestamp = new Date().toISOString();
  const delayHours = Math.round((pax.delayHours || 0) * 10) / 10;

  // Determine tone based on distress level
  const tone = result.distressLevel === 'Critical' ? 'urgent'
    : result.distressLevel === 'High' ? 'empathetic'
    : result.distressLevel === 'Medium' ? 'apologetic'
    : 'neutral';

  // Build template based on primary action
  let message = '';
  let messageType = '';
  let includedElements: string[] = ['flight_info', 'passenger_name', 'recovery_action'];
  let qrCodeRequired = false;
  let qrCodeType: 'voucher' | 'lounge' | 'ticket' | null = null;

  const delayText = pax.disruptionType === 'CANCELLATION'
    ? 'your flight has been cancelled'
    : `your flight is delayed by ${delayHours} hours`;

  const paxName = pax.name.split(' ')[0]; // First name only

  switch (result.recommendedAction) {
    case 'Same Metal Recovery + Hotel & Meal Vouchers':
    case 'Partner Metal Recovery + Hotel & Meal Vouchers':
    case 'Interline Metal Recovery + Hotel & Meal Vouchers':
    case 'Alternative Flight + Hotel':
      messageType = 'rebook_confirmed';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've rebooked you on the next available flight with hotel accommodation for tonight. Check your email for full details. Reply with HELP if you need anything.`;
      includedElements.push('recovery_action');
      qrCodeRequired = true;
      qrCodeType = 'ticket';
      break;

    case 'Alternative Flight Only':
    case 'Premium Recovery Option':
      messageType = 'rebook_confirmed';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've arranged an alternative flight for you. You'll receive the updated boarding pass details shortly. Reply with HELP if you have questions.`;
      includedElements.push('recovery_action');
      break;

    case 'Original Flight Maintained + Lounge Access Issued':
      messageType = 'lounge';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've arranged complimentary lounge access for you while you wait. Scan the QR code below to enter and enjoy refreshments. [QR CODE PLACEHOLDER]`;
      includedElements.push('recovery_action', 'qr_code');
      qrCodeRequired = true;
      qrCodeType = 'lounge';
      break;

    case 'Original Flight Maintained + Meal Voucher Issued':
      messageType = 'meal_voucher';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We're providing meal vouchers for you and your travel party. Scan the QR code below to redeem at airport restaurants. [QR CODE PLACEHOLDER]`;
      includedElements.push('recovery_action', 'qr_code');
      qrCodeRequired = true;
      qrCodeType = 'voucher';
      break;

    case 'Hotel and Meal Vouchers':
      messageType = 'hotel';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've arranged hotel accommodation and meal vouchers for you. Check your email for hotel details and scan the QR code for your meals. [QR CODE PLACEHOLDER]`;
      includedElements.push('recovery_action', 'qr_code');
      qrCodeRequired = true;
      qrCodeType = 'voucher';
      break;

    case 'Priority Concierge Triage':
    case 'Manual Handling Required':
    case 'Manual Override':
      messageType = 'ESCALATION';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. A dedicated agent is personally handling your case and will be in touch momentarily. We appreciate your patience.`;
      includedElements.push('recovery_action');
      break;

    case 'Original Flight Maintained + Notification Only':
    case 'Notification Only':
    default:
      messageType = 'INFORMATIONAL';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. Our team is working to resolve this as quickly as possible. We'll update you shortly with next steps. Reply with HELP if you need immediate assistance.`;
      includedElements.push('recovery_action');
  }

  return {
    message,
    messageType,
    tone,
    includedElements,
    qrCodeRequired,
    qrCodeType,
    generatedAt: timestamp,
    passengerPnr: pax.pnr,
    aiPowered: false
  };
}

export async function generateWhatsAppMessage(
  pax: Passenger,
  result: AnalysisResult
): Promise<WhatsAppMessage> {
  const timestamp = new Date().toISOString();

  try {
    // Determine tone based on distress level
    const toneToDiagnostics = {
      'Critical': 'urgent',
      'High': 'empathetic',
      'Medium': 'apologetic',
      'Low': 'neutral'
    };

    const tone = (result.distressLevel
      ? toneToDiagnostics[result.distressLevel as keyof typeof toneToDiagnostics]
      : undefined) ?? 'neutral';

    // Call Claude API to generate message
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useCase: 'whatsapp-message',
        payload: {
          passengerContext: {
            pnr: pax.pnr,
            name: pax.name,
            cabin: pax.cabin,
            tier: pax.tier,
            loyaltyTier: pax.loyaltyTier,
            ssrCode: pax.ssrCode,
            flightNumber: pax.flightNumber,
            origin: pax.origin,
            destination: pax.destination,
            disruptionType: pax.disruptionType,
            disruptionCause: pax.disruptionCause,
            delayHours: pax.delayHours || 0,
            delayMinutes: Math.round((pax.delayHours || 0) * 60),
            travelPartySize: pax.travelPartySize,
            jurisdiction: pax.jurisdiction
          },
          recoveryDecision: {
            primaryAction: result.recommendedAction,
            distressLevel: result.distressLevel,
            tone,
            goodwillAction: {
              notificationRequired: result.goodwillAction?.notificationRequired,
              mealVoucherOffered: result.goodwillAction?.mealVoucherOffered,
              mealVoucherValue: result.goodwillAction?.mealVoucherValue,
              loungeAccessOffered: result.goodwillAction?.loungeAccessOffered,
              personalOutreachRequired: result.goodwillAction?.personalOutreachRequired,
              whatsappMessageType: result.goodwillAction?.whatsappMessageType,
              talkToAgentOption: result.goodwillAction?.talkToAgentOption
            },
            recoveryDecision: {
              primaryAction: result.recommendedAction,
              rebookEligible: result.recoveryDecision?.rebookEligible,
              rebookCarrierOrder: result.recoveryDecision?.rebookCarrierOrder,
              hotelRequired: result.recoveryDecision?.hotelRequired,
              mealsRequired: result.recoveryDecision?.mealsRequired,
              loungeRequired: result.recoveryDecision?.loungeRequired,
              offerRefundAlternative: result.recoveryDecision?.offerRefundAlternative,
              requiresAgentIntervention: result.recoveryDecision?.requiresAgentIntervention
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const responseData = await response.json() as { data: WhatsappMessageClaudeResponse };
    const data = responseData.data;

    console.log(
      `[${timestamp}] WhatsApp Message Generated | PNR: ${pax.pnr} | useCase: whatsapp-message | Source: Claude API`
    );

    return {
      message: data.message,
      messageType: data.messageType,
      tone: data.tone,
      includedElements: data.includedElements,
      qrCodeRequired: data.qrCodeRequired,
      qrCodeType: data.qrCodeType,
      generatedAt: timestamp,
      passengerPnr: pax.pnr,
      aiPowered: true
    };
  } catch (error) {
    const timestamp2 = new Date().toISOString();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(
      `[${timestamp2}] WhatsApp Message Generation Failed | PNR: ${pax.pnr} | useCase: whatsapp-message | Source: Template Fallback | Error: ${errorMsg}`
    );

    // Fallback to template message
    return generateTemplateMessage(pax, result);
  }
}

interface GateAgentClaudeResponse {
  recommendedAction: string;
  details: string;
  justification: string;
  distressLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  distressReason: string;
  regulatoryBasis: string;
  regulatoryNote: string;
  priorityScore: number;
  flaggedIssues?: string[];
  agentTalkingPoints?: string[];
  recoveryOptions?: RecoveryOption[];
}

/**
 * Compute baseline rule engine result using helper functions
 * Used as foundation for Claude AI enhancement
 */
export function computeRuleEngineBaseline(
  pax: Passenger,
  actionOverride?: ActionType
): AnalysisResult {
  const delayMinutes = pax.delayMinutes || 0;
  const disruptionType = pax.disruptionType || 'DELAY';
  const jurisdiction = pax.jurisdiction || 'EU261';
  const haul = pax.haul || 'Short';

  // EU261 Article 9 haul-based care thresholds (departure delay)
  // Short (<1500km): meals from 2h; Medium (1500–3500km): meals from 3h; Long (>3500km): meals from 4h
  const eu261MealsThreshold = haul === 'Short' ? EU261_MEALS_SHORT_THRESHOLD : haul === 'Medium' ? EU261_SHORT_MEDIUM_THRESHOLD : EU261_LONG_THRESHOLD;

  // Compute overnight stranding: canonical threshold 8h (480 min)
  const isOvernightStranding = delayMinutes >= OVERNIGHT_THRESHOLD_MINUTES;

  // APPR cash compensation thresholds (arrival delay, CAD)
  const isAPPR = jurisdiction.includes('APPR');
  const isAPPRLarge = jurisdiction === 'APPR_LARGE';
  let apprCashComp = 0;
  if (isAPPR && delayMinutes >= EU261_SHORT_MEDIUM_THRESHOLD) {
    if (isAPPRLarge) {
      apprCashComp = delayMinutes >= 540 ? 1000 : delayMinutes >= 360 ? 700 : 400;
    } else {
      apprCashComp = delayMinutes >= 540 ? 500 : delayMinutes >= 360 ? 250 : 125;
    }
  }

  // Smart action recommendation based on severity and jurisdiction
  let primaryAction = actionOverride;
  if (!primaryAction) {
    if (disruptionType === 'CANCELLATION' || delayMinutes >= 300) {
      primaryAction = 'Same Metal Recovery + Hotel & Meal Vouchers';
    } else if (jurisdiction.includes('EU261') && delayMinutes >= eu261MealsThreshold) {
      primaryAction = 'Original Flight Maintained + Meal Voucher Issued';
    } else if (jurisdiction.includes('USDOT')) {
      const isDomestic = jurisdiction === 'USDOT_DOMESTIC';
      const usdotThreshold = isDomestic ? EU261_SHORT_MEDIUM_THRESHOLD : 300;
      primaryAction = delayMinutes >= usdotThreshold
        ? 'Original Flight Maintained + Meal Voucher Issued'
        : 'Original Flight Maintained + Notification Only';
    } else if (isAPPR && delayMinutes >= 540) {
      // APPR 9h+ — rerouting obligation for large carriers
      primaryAction = isAPPRLarge
        ? 'Same Metal Recovery + Hotel & Meal Vouchers'
        : 'Original Flight Maintained + Meal Voucher Issued';
    } else if (delayMinutes >= EU261_MEALS_SHORT_THRESHOLD) {
      primaryAction = 'Original Flight Maintained + Meal Voucher Issued';
    } else {
      primaryAction = 'Original Flight Maintained + Notification Only';
    }
  }

  // Determine regulatory basis from jurisdiction
  let regulatoryBasis = 'None';
  if (jurisdiction.includes('EU261')) {
    regulatoryBasis = 'EU261';
  } else if (jurisdiction.includes('USDOT')) {
    regulatoryBasis = 'USDOT';
  } else if (isAPPR) {
    regulatoryBasis = 'APPR';
  }

  // Derive duty of care flags — EU261 haul-based; APPR mirrors EU261 thresholds
  const dutyOfCareHotel = disruptionType === 'CANCELLATION' || isOvernightStranding || delayMinutes >= 300;
  const dutyOfCareMeals = disruptionType === 'CANCELLATION' ||
    (jurisdiction.includes('EU261') && delayMinutes >= eu261MealsThreshold) ||
    (!jurisdiction.includes('EU261') && delayMinutes >= EU261_MEALS_SHORT_THRESHOLD);
  const mealVoucherOffered = dutyOfCareMeals;
  const mealVoucherValue = dutyOfCareMeals ? MEAL_VOUCHER_RATE : 0;

  // Determine if international (affects CLV multiplier)
  const isInternational = pax.haul === 'Long' || pax.haul === 'Medium';

  // Calculate costs using helper functions
  const aeroAgentCost = calculateAeroAgentCost(
    primaryAction,
    pax.ticketValue || 0,
    pax.oalCost || 0,
    pax.hotelCost || 0,
    mealVoucherOffered,
    mealVoucherValue,
    dutyOfCareHotel,
    dutyOfCareMeals  // FIX 7: was missing 8th argument
  );

  const legacyCostTotal = calculateLegacyCost(
    primaryAction,
    delayMinutes,
    disruptionType,
    jurisdiction,
    pax.cabin || 'Economy',
    pax.loyaltyTier || 'None',
    pax.ticketValue || 0,
    dutyOfCareHotel
  );

  const clv = calculateCLV(
    pax.cabin || 'Economy',   // FIX 6: cabin first
    pax.loyaltyTier || 'None', // loyaltyTier second
    pax.ticketValue || 350,   // ticketValue third
    isInternational            // FIX 6: was missing
  );

  const churnPropensity = getChurnPropensity(
    delayMinutes,
    disruptionType,
    pax.loyaltyTier || 'None'
  );

  const churnEV = clv * churnPropensity;
  const netSavings = legacyCostTotal - aeroAgentCost;

  // Determine distress level
  let distressLevel = 'Low';
  if (disruptionType === 'CANCELLATION') {
    distressLevel = 'High';
  } else if (delayMinutes >= 600) {
    distressLevel = 'Critical';
  } else if (delayMinutes >= 300) {
    distressLevel = 'High';
  } else if (delayMinutes >= EU261_MEALS_SHORT_THRESHOLD) {
    distressLevel = 'Medium';
  }

  // EU261 extraordinary circumstances — WEATHER, ATC, SECURITY waive cash compensation (Article 5(3))
  const isExtraordinaryCircumstance = ['WEATHER', 'ATC', 'SECURITY'].includes(pax.disruptionCause || '');

  // EU261 cash compensation amount (distance-based, zero if extraordinary circumstances)
  // Long-haul flights (>3500 km) require ≥240 min delay; short/medium require ≥180 min (Article 7)
  const eu261CashCompThreshold = haul === 'Long' ? EU261_LONG_THRESHOLD : EU261_SHORT_MEDIUM_THRESHOLD;
  const eu261CashComp =
    jurisdiction.includes('EU261') && delayMinutes >= eu261CashCompThreshold && !isExtraordinaryCircumstance
      ? haul === 'Short' ? EU261_SHORT_HAUL_AMOUNT : haul === 'Medium' ? EU261_MEDIUM_HAUL_AMOUNT : EU261_LONG_HAUL_AMOUNT
      : 0;

  // Total cash compensation owed (EU261 or APPR)
  const cashCompensationAmount = eu261CashComp > 0 ? eu261CashComp : apprCashComp;

  // Build legacy cost breakdown
  const legacyCostBreakdown: CostBreakdown = {
    dutyOfCare: Math.min(45 + (legacyCostTotal > 50 ? 150 : 0), legacyCostTotal),
    eu261: eu261CashComp,
    usDot: 0,
    churnPenalty: 0,
    total: legacyCostTotal
  };

  // Return baseline result
  return {
    isVIP: pax.loyaltyTier === 'Platinum',
    isOALEligible: true,
    legacy: legacyCostBreakdown,
    internal: {
      dutyOfCare: 0,
      fare: pax.ticketValue || 0,
      total: (pax.ticketValue || 0) + (pax.oalCost || 0)
    },
    recommendedAction: primaryAction as ActionType,
    suggestedStatus: 'pending_triage',
    valueTag: 'standard',
    aeroAgentCost,
    netSavings,
    rationale: 'Rule engine baseline — awaiting Claude AI enhancement',
    distressLevel,
    eu261Max: eu261CashComp,
    eu261Likelihood: eu261CashComp > 0 ? 0.7 : 0,
    eu261EV: eu261CashComp * (eu261CashComp > 0 ? 0.7 : 0),
    cashCompensationAmount,
    clv,
    churnPropensity,
    churnEV,
    totalEV: churnEV + eu261CashComp * (eu261CashComp > 0 ? 0.7 : 0),
    regulatoryBasis,
    aiPowered: false,
    goodwillAction: {
      notificationRequired: true,
      mealVoucherOffered: dutyOfCareMeals,
      mealVoucherValue: dutyOfCareMeals ? MEAL_VOUCHER_RATE : 0,
      loungeAccessOffered: (pax.cabin === 'Business' || pax.cabin === 'F' || pax.cabin === 'J') && delayMinutes >= 90,
      loungeAccess: (pax.cabin === 'Business' || pax.cabin === 'F' || pax.cabin === 'J') && delayMinutes >= 90,
      personalOutreachRequired: pax.loyaltyTier === 'Platinum' || pax.tier === 'Platinum' || pax.tier === 'Platinum Lumo' || pax.tier === 'oneworld Emerald',
      whatsappMessageType: (dutyOfCareMeals ? 'MEAL_VOUCHER' : 'NOTIFICATION_ONLY') as WhatsappMessageType,
      talkToAgentOption: delayMinutes >= 300 || disruptionType === 'CANCELLATION',
    },
    recoveryDecision: {
      primaryAction: (() => {
        const a = (primaryAction as string).toLowerCase();
        if (a.includes('partner metal')) return 'REBOOK_PARTNER';
        if (a.includes('interline metal')) return 'REBOOK_INTERLINE';
        if (a.includes('same metal') || a.includes('recovery')) return 'REBOOK_SAME_METAL';
        if (a.includes('hotel') && (a.includes('recovery') || a.includes('rebook') || a.includes('metal'))) return 'REBOOK_AND_HOTEL';
        if (a.includes('hotel')) return 'HOTEL_AND_MEALS';
        if (a.includes('lounge')) return 'LOUNGE_ACCESS';
        if (a.includes('meal') || a.includes('voucher')) return 'MEAL_VOUCHER';
        if (a.includes('concierge') || a.includes('manual') || a.includes('priority')) return 'ESCALATE_TO_AGENT';
        return 'NOTIFICATION_ONLY';
      })() as RecoveryPrimaryAction,
      rebookEligible: (primaryAction as string).toLowerCase().includes('recovery') || (primaryAction as string).toLowerCase().includes('metal') || disruptionType === 'CANCELLATION',
      rebookCarrierOrder: pax.partnerSeatAvailable ? ['SAME_METAL', 'PARTNER', 'INTERLINE'] : ['SAME_METAL'],
      hotelRequired: dutyOfCareHotel,
      mealsRequired: dutyOfCareMeals,
      loungeRequired: (pax.cabin === 'Business' || pax.cabin === 'F' || pax.cabin === 'J') && delayMinutes >= 90,
      acceptableRebookWindow: delayMinutes >= 600 ? 'NEXT_DAY' : 'SAME_DAY',
      offerRefundAlternative: disruptionType === 'CANCELLATION',
      requiresAgentIntervention: (primaryAction as string).includes('Concierge') || (primaryAction as string).includes('Manual') || pax.ssrCode === 'UMNR',
    },
  };
}

export async function computeEngineAI(
  pax: Passenger,
  actionOverride?: ActionType
): Promise<AnalysisResult> {
  const timestamp = new Date().toISOString();

  // Step 1: Run rule engine baseline
  const ruleResult = computeRuleEngineBaseline(pax, actionOverride);

  // Retry configuration: up to 2 retries with exponential backoff for 429/500/529
  const MAX_RETRIES = 2;
  const requestBody = JSON.stringify({
    useCase: 'gate-agent',
    payload: {
      passenger: {
        pnr: pax.pnr,
        name: pax.name,
        cabin: pax.cabin,
        tier: pax.tier,
        loyaltyTier: pax.loyaltyTier,
        ssrCode: pax.ssrCode,
        flightNumber: pax.flightNumber,
        origin: pax.origin,
        destination: pax.destination,
        disruptionType: pax.disruptionType,
        disruptionCause: pax.disruptionCause,
        delayMinutes: Math.round((pax.delayHours || 0) * 60),
        jurisdiction: pax.jurisdiction,
        hasConnection: pax.hasConnection,
        connectionBufferMinutes: pax.connectionBufferMinutes,
        travelPartySize: pax.travelPartySize,
        hasInfant: pax.hasInfant,
        ticketValue: pax.ticketValue
      },
      ruleEngineAssessment: {
        recommendedAction: ruleResult.recommendedAction,
        suggestedStatus: ruleResult.suggestedStatus,
        distressLevel: ruleResult.liabilityEngine?.itinerary.status === 'Rebooked' ? 'High' : 'Medium',
        valuationTag: ruleResult.valueTag,
        liabilityExposure: {
          eu261: ruleResult.eu261Max,
          dutyOfCare: ruleResult.legacy.dutyOfCare,
          total: ruleResult.legacy.total
        }
      }
    }
  });

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s
        await new Promise(r => setTimeout(r, 1000 * attempt));
        console.log(`[engine] Retry ${attempt}/${MAX_RETRIES} for PNR: ${pax.pnr}`);
      }

    // Step 2: Call Claude API with retry-safe payload
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    });

    if (!response.ok) {
      const retryable = response.status === 429 || response.status === 500 || response.status === 529;
      if (retryable && attempt < MAX_RETRIES) {
        lastError = new Error(`API error: ${response.status}`);
        continue; // retry
      }
      throw new Error(`API error: ${response.status}`);
    }

    const responseData = await response.json() as { data: GateAgentClaudeResponse };
    const data = responseData.data;

    console.log(
      `[${timestamp}] Claude AI Analysis | PNR: ${pax.pnr} | useCase: gate-agent | Source: Claude API`
    );

    // Step 3: Merge Claude response into rule engine result
    console.log(
      `[${timestamp}] Claude AI Analysis | PNR: ${pax.pnr} | useCase: gate-agent | Source: Claude API`
    );
    return {
      ...ruleResult,
      aiPowered: true,
      aiJustification: data.justification,
      aiDistressLevel: data.distressLevel,
      aiDistressReason: data.distressReason,
      aiRegulatoryBasis: data.regulatoryBasis,
      aiRegulatoryNote: data.regulatoryNote,
      aiPriorityScore: data.priorityScore,
      aiFlaggedIssues: data.flaggedIssues ?? [],
      aiAgentTalkingPoints: data.agentTalkingPoints ?? [],
      recoveryOptions: data.recoveryOptions // MOD 3: Multiple recovery options from AI
    };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue; // will retry
    }
  } // end retry loop

  // All retries exhausted — fall back to rule engine result
  const timestamp2 = new Date().toISOString();
  console.error(
    `[${timestamp2}] Claude AI Analysis Failed | PNR: ${pax.pnr} | useCase: gate-agent | Status: REQUIRES RETRY | Error: ${lastError.message}`
  );

  // MOD 4: Return aiUnavailable flag - UI shows retry button, NOT silent fallback
  return {
    ...ruleResult,
    aiUnavailable: true,
    aiPoweredError: lastError.message
  };
}

export async function generateHandoffBriefing(
  pax: Passenger,
  result: AnalysisResult,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>,
  stressSignals: string[],
  escalationReason: string
): Promise<HandoffBriefing> {
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useCase: 'escalation-handoff',
        payload: {
          passenger: {
            pnr: pax.pnr,
            name: pax.name,
            cabin: pax.cabin,
            tier: pax.tier,
            loyaltyTier: pax.loyaltyTier,
            ssrCode: pax.ssrCode,
            flightNumber: pax.flightNumber,
            origin: pax.origin,
            destination: pax.destination,
            disruptionType: pax.disruptionType,
            disruptionCause: pax.disruptionCause,
            delayMinutes: Math.round((pax.delayHours || 0) * 60),
            jurisdiction: pax.jurisdiction,
            travelPartySize: pax.travelPartySize,
            hasInfant: pax.hasInfant
          },
          recoveryArranged: {
            primaryAction: result.recoveryDecision?.primaryAction,
            mealVoucher: result.goodwillAction?.mealVoucherOffered ?? false,
            loungeAccess: result.goodwillAction?.loungeAccessOffered ?? false,
            hotelArranged: result.recoveryDecision?.hotelRequired ?? false,
            rebookEligible: result.recoveryDecision?.rebookEligible ?? false
          },
          conversationHistory: conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
          })),
          stressSignals,
          escalationReason,
          aiDistressLevel: result.aiDistressLevel,
          aiFlaggedIssues: result.aiFlaggedIssues
        }
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const responseData = await response.json() as { data: HandoffBriefing };
    const data = responseData.data;

    console.log(
      `[${timestamp}] Handoff Briefing Generated | PNR: ${pax.pnr} | useCase: escalation-handoff | Source: Claude API`
    );

    return {
      ...data,
      generatedAt: timestamp,
      passengerPnr: pax.pnr,
      conversationLength: conversationHistory.length
    };
  } catch (error) {
    const timestamp2 = new Date().toISOString();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(
      `[${timestamp2}] Handoff Briefing Failed | PNR: ${pax.pnr} | useCase: escalation-handoff | Source: Fallback | Error: ${errorMsg}`
    );

    // Fallback briefing
    return {
      summary: `Passenger ${pax.name} has escalated regarding their disrupted flight ${pax.flightNumber}. They need immediate assistance from a gate agent.`,
      passengerConcern: escalationReason,
      emotionalState: 'Distressed',
      urgencyLevel: (result.aiDistressLevel || 'High') as 'Critical' | 'High' | 'Medium' | 'Low',
      whatWasArranged: [result.recoveryDecision?.primaryAction ?? 'Notification Only'],
      suggestedOpeningLine: `Hi ${pax.name.split(' ')[0]}, I can see you need some help — I am here and I have your full details in front of me.`,
      sensitiveIssues: result.aiFlaggedIssues ?? [],
      recommendedAction: `Review passenger situation and provide personalized assistance with their ${pax.disruptionType || 'disruption'}.`,
      estimatedResolutionTime: '10 mins',
      generatedAt: timestamp2,
      passengerPnr: pax.pnr,
      conversationLength: conversationHistory.length
    };
  }
}

interface AuditNarrativeClaudeResponse {
  narrative: string;
  regulationCited: string;
  liabilityBreakdown: {
    description: string;
    gross: number;
    recovery: number;
    net: number;
  };
  complianceStatus: 'Compliant' | 'Review Required' | 'Non-Compliant';
  exceptionFlag: boolean;
  exceptionNote: string | null;
  auditRiskLevel: 'Low' | 'Medium' | 'High';
  recommendedDocumentation: string[];
}

function generateAuditNarrativeFallback(
  pax: Passenger,
  result: AnalysisResult
): AuditNarrative {
  const timestamp = new Date().toISOString();

  // Determine compliance status based on recovery action and distress level
  let complianceStatus: 'Compliant' | 'Review Required' | 'Non-Compliant' = 'Compliant';
  let auditRiskLevel: 'Low' | 'Medium' | 'High' = 'Low';

  // Flag non-compliant cases
  if (result.distressLevel === 'Critical' && result.recoveryDecision?.requiresAgentIntervention) {
    complianceStatus = 'Review Required';
    auditRiskLevel = 'High';
  } else if (result.recoveryDecision?.requiresAgentIntervention) {
    complianceStatus = 'Review Required';
    auditRiskLevel = 'Medium';
  }

  const regulationMap: { [key: string]: string } = {
    'EU': 'EU261/2004 Articles 5, 7, 9',
    'EU261': 'EU261/2004 Articles 5, 7, 9',
    'UK261': 'UK261 Articles 5, 7, 9',
    'USDOT_DOMESTIC': 'US DOT Part 250',
    'USDOT_INTERNATIONAL': 'US DOT Part 250 & Montreal Convention',
    'APPR_LARGE': 'Canada APPR (Large Carrier)',
    'APPR_SMALL': 'Canada APPR (Small Carrier)',
    'Other': 'Goodwill Policy'
  };

  const regulationCited = regulationMap[pax.jurisdiction] || 'Applicable Regulations';

  const narrative = `Passenger ${pax.name} (PNR: ${pax.pnr}) experienced a ${pax.disruptionType || 'disruption'} on flight ${pax.flightNumber} from ${pax.origin} to ${pax.destination}. Recovery action applied: ${result.recommendedAction}. Passenger entitled to duty of care and regulatory protections under ${regulationCited}. Estimated financial exposure: €${result.aeroAgentCost || 0}. AeroAgent intervention cost: €${result.aeroAgentCost || 0}. Net impact: €${result.netSavings || 0}.`;

  const grossLiability = result.legacy?.total || 0;
  const recoveryCost = result.aeroAgentCost || 0;
  const netSavings = result.netSavings || 0;

  const liabilityBreakdown = {
    description: `Gross liability of €${grossLiability.toFixed(2)} consists of duty of care (€${(result.legacy?.dutyOfCare || 0).toFixed(2)}) and EU261 exposure (€${(result.legacy?.eu261 || 0).toFixed(2)}). Recovery cost of €${recoveryCost.toFixed(2)} results in net savings of €${netSavings.toFixed(2)}.`,
    gross: grossLiability,
    recovery: recoveryCost,
    net: netSavings
  };

  return {
    narrative,
    regulationCited,
    liabilityBreakdown,
    complianceStatus,
    exceptionFlag: complianceStatus !== 'Compliant',
    exceptionNote: complianceStatus !== 'Compliant' ? `Flagged for review: ${result.recommendedAction}` : null,
    auditRiskLevel,
    recommendedDocumentation: ['PNR record', 'Disruption notice', 'Recovery arrangement confirmation', 'Passenger communication log'],
    generatedAt: timestamp,
    passengerPnr: pax.pnr,
    aiPowered: false
  };
}

export async function generateAuditNarrative(
  pax: Passenger,
  result: AnalysisResult
): Promise<AuditNarrative> {
  const timestamp = new Date().toISOString();

  try {
    // Call Claude API to generate audit narrative
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useCase: 'cfo-audit',
        payload: {
          passenger: {
            pnr: pax.pnr,
            name: pax.name,
            cabin: pax.cabin,
            tier: pax.tier,
            loyaltyTier: pax.loyaltyTier,
            ssrCode: pax.ssrCode,
            flightNumber: pax.flightNumber,
            origin: pax.origin,
            destination: pax.destination,
            disruptionType: pax.disruptionType,
            disruptionCause: pax.disruptionCause,
            delayMinutes: Math.round((pax.delayHours || 0) * 60),
            delayHours: pax.delayHours || 0,
            jurisdiction: pax.jurisdiction,
            carrierSize: pax.carrierSize
          },
          recoveryDecision: {
            primaryAction: result.recommendedAction,
            finalAction: result.recommendedAction,
            wasOverridden: !!pax.overrideAction,
            overrideRationale: pax.overrideRationale || '',
            rebookEligible: result.recoveryDecision?.rebookEligible ?? false,
            hotelRequired: result.recoveryDecision?.hotelRequired ?? false,
            mealsRequired: result.recoveryDecision?.mealsRequired ?? false,
            loungeRequired: result.recoveryDecision?.loungeRequired ?? false,
            offerRefundAlternative: result.recoveryDecision?.offerRefundAlternative ?? false,
            requiresAgentIntervention: result.recoveryDecision?.requiresAgentIntervention ?? false
          },
          financials: {
            ticketValue: pax.ticketValue || 0,
            aeroAgentCost: result.aeroAgentCost,
            netSavings: result.netSavings,
            eu261Ev: result.eu261EV,
            eu261Max: result.eu261Max,
            eu261Likelihood: result.eu261Likelihood,
            cashCompensation: result.cashCompensationAmount || 0,
            dutyOfCareEstimate: result.legacy?.dutyOfCare || 0,
            mealVoucherValue: result.goodwillAction?.mealVoucherValue || 0
          },
          regulatory: {
            jurisdiction: pax.jurisdiction,
            isControllableCause: !['WEATHER', 'ATC', 'SECURITY'].includes(pax.disruptionCause || ''),
            regulatoryNote: `${pax.jurisdiction} regulations apply. Disruption cause: ${pax.disruptionCause || 'Unknown'}`
          },
          aiAnalysis: {
            aiPowered: true,
            aiJustification: result.aiJustification || result.rationale,
            aiFlaggedIssues: result.aiFlaggedIssues || [],
            aiDistressLevel: result.aiDistressLevel || result.distressLevel,
            distressReasons: [result.distressReason || 'Flight disruption']
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const responseData = await response.json() as { data: Partial<AuditNarrativeClaudeResponse> };
    const data = responseData.data;

    // Determine compliance status if not provided
    const complianceStatus = data.complianceStatus || (data.exceptionFlag ? 'Review Required' : 'Compliant');

    // Determine risk level if not provided
    const auditRiskLevel = data.auditRiskLevel || (
      data.exceptionFlag && data.narrative?.toLowerCase().includes('critical') ? 'High' :
      data.exceptionFlag ? 'Medium' :
      'Low'
    );

    // Ensure all required fields exist
    const liabilityBreakdown = data.liabilityBreakdown || {
      description: 'Unable to determine liability from available data',
      gross: 0,
      recovery: 0,
      net: 0
    };

    const recommendedDocumentation = data.recommendedDocumentation || [
      'PNR record',
      'Disruption evidence',
      'Recovery arrangement confirmation',
      'Passenger communication logs'
    ];

    console.log(
      `[${timestamp}] Audit Narrative Generated | PNR: ${pax.pnr} | useCase: cfo-audit | Source: Claude API`
    );

    return {
      narrative: data.narrative || 'No narrative generated',
      regulationCited: data.regulationCited || 'Applicable Regulations',
      liabilityBreakdown,
      complianceStatus,
      exceptionFlag: data.exceptionFlag ?? false,
      exceptionNote: data.exceptionNote || null,
      auditRiskLevel,
      recommendedDocumentation,
      generatedAt: timestamp,
      passengerPnr: pax.pnr,
      aiPowered: true
    };
  } catch (error) {
    const timestamp2 = new Date().toISOString();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(
      `[${timestamp2}] Audit Narrative Generation Failed | PNR: ${pax.pnr} | useCase: cfo-audit | Source: Template Fallback | Error: ${errorMsg}`
    );

    // Fallback to template narrative
    return generateAuditNarrativeFallback(pax, result);
  }
}


// MOD 4: AI-ONLY PROCESSING - No fallback to rule engine
// All analysis must go through Claude API with explicit aiUnavailable flag on failure
export const computeEngine = computeEngineAI;
