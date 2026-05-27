import {
  Passenger,
  AnalysisResult,
  CostBreakdown,
  ActionType,
  PaxStatus,
  DisruptionLiabilityEngine,
  WhatsAppMessage,
  HandoffBriefing,
  AuditNarrative,
  ChatMessage,
} from './types';
import { differenceInHours, parseISO } from 'date-fns';

export function computeEngineLocal(
  pax: Passenger,
  actionOverride?: ActionType
): AnalysisResult {
  const schedArr = parseISO(pax.scheduledArrival);
  const estArr = parseISO(pax.estimatedArrival);
  const delayHours = Math.max(0, differenceInHours(estArr, schedArr));

  // ============================================================================
  // LAYER 1: PRIORITY ASSESSMENT
  // ============================================================================

  let priorityScore = 0;
  const priorityReasons: string[] = [];

  // SSR-based priority (40 points max)
  const isUMNR = pax.ssrCode === 'UMNR';
  const isMEDA = pax.ssrCode === 'MEDA';
  const isWCHR = pax.ssrCode === 'WCHR';
  const isSpecialNeeds = isUMNR || isMEDA || isWCHR || pax.ssrCode === 'BLND' || pax.ssrCode === 'DEAF' || pax.ssrCode === 'WCHC' || pax.ssrCode === 'WCHS' || pax.ssrCode === 'DPNA' || pax.ssrCode === 'MAAS';

  if (isUMNR) {
    priorityScore += 40;
    priorityReasons.push('Unaccompanied minor (UMNR)');
  } else if (isMEDA) {
    priorityScore += 35;
    priorityReasons.push('Medical assistance required (MEDA)');
  } else if (isWCHR) {
    priorityScore += 30;
    priorityReasons.push('Wheelchair user with full assistance (WCHR)');
  } else if (isSpecialNeeds) {
    priorityScore += 25;
    priorityReasons.push(`Special needs passenger (${pax.ssrCode})`);
  }

  // Cabin/Tier-based priority (30 points max)
  const premiumTiers = ['Platinum', 'Platinum Lumo', 'oneworld Emerald', 'Gold'];
  const isPremiumTier = premiumTiers.includes(pax.tier);
  const isPremiumCabin = pax.cabin === 'Business';

  if (pax.cabin === 'Business') {
    priorityScore += 25;
    priorityReasons.push('Premium cabin (Business)');
  } else if (pax.cabin === 'Premium Economy') {
    priorityScore += 15;
    priorityReasons.push('Premium Economy cabin');
  }

  if (pax.tier === 'Platinum Lumo' || pax.tier === 'oneworld Emerald') {
    priorityScore += 30;
    priorityReasons.push(`Top loyalty tier (${pax.tier})`);
  } else if (pax.tier === 'Platinum') {
    priorityScore += 25;
    priorityReasons.push('Platinum loyalty tier');
  } else if (pax.tier === 'Gold') {
    priorityScore += 15;
    priorityReasons.push('Gold loyalty tier');
  } else if (pax.tier === 'Silver') {
    priorityScore += 8;
    priorityReasons.push('Silver loyalty tier');
  }

  // Disruption type/timing-based priority (20 points max)
  if (pax.disruptionType === 'CANCELLATION') {
    priorityScore += 20;
    priorityReasons.push('Flight cancellation');
  } else if (delayHours >= 12) {
    priorityScore += 20;
    priorityReasons.push('Severe delay (≥12h)');
  } else if (delayHours >= 6) {
    priorityScore += 12;
    priorityReasons.push('Major delay (6-12h)');
  } else if (delayHours >= 3) {
    priorityScore += 6;
    priorityReasons.push('Significant delay (3-6h)');
  }

  if (pax.timing === 'Overnight' && delayHours >= 5) {
    priorityScore += 15;
    priorityReasons.push('Overnight disruption with hotel required');
  }

  // Travel party risk (15 points max)
  if (pax.partySize >= 4) {
    priorityScore += 10;
    priorityReasons.push(`Large travel party (${pax.partySize} pax)`);
  }
  if (pax.hasInfant) {
    priorityScore += 15;
    priorityReasons.push('Infant on booking');
  }

  // Connection risk (15 points max)
  if (pax.hasConnection && pax.connectionBufferMinutes && pax.connectionBufferMinutes < 120) {
    priorityScore += 15;
    priorityReasons.push(`Tight connection (${pax.connectionBufferMinutes}m buffer)`);
  }

  const distressScore = Math.min(200, priorityScore);
  let distressLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  if (distressScore >= 120) {
    distressLevel = 'Critical';
  } else if (distressScore >= 80) {
    distressLevel = 'High';
  } else if (distressScore >= 40) {
    distressLevel = 'Medium';
  } else {
    distressLevel = 'Low';
  }

  let priorityTier: 1 | 2 | 3 | 4;
  if (isSpecialNeeds || distressLevel === 'Critical') {
    priorityTier = 1;
  } else if (isPremiumCabin || (isPremiumTier && delayHours >= 3)) {
    priorityTier = 2;
  } else if (isPremiumTier) {
    priorityTier = 3;
  } else {
    priorityTier = 4;
  }

  const priorityAssessment = {
    isPriority: priorityTier <= 2,
    priorityTier,
    priorityReasons,
    isUMNR,
    distressScore,
    distressLevel,
    distressReasons: priorityReasons,
  };

  // ============================================================================
  // LAYER 2: REGULATORY ASSESSMENT
  // ============================================================================

  const isControllableCause =
    pax.disruptionCause === 'TECHNICAL' ||
    pax.disruptionCause === 'OPERATIONAL' ||
    (pax.disruptionReason === 'Crew Scheduling' ||
      pax.disruptionReason === 'Late Inbound' ||
      pax.disruptionReason === 'Technical');

  const isExtraordinaryCircumstance =
    pax.disruptionCause === 'WEATHER' ||
    pax.disruptionReason === 'Weather' ||
    pax.disruptionCause === 'ATC' ||
    pax.disruptionReason === 'ATC' ||
    pax.disruptionCause === 'SECURITY' ||
    pax.disruptionReason === 'SECURITY';

  let cashCompensationOwed = false;
  let cashCompensationAmount = 0;
  let cashCompensationCurrency: 'EUR' | 'USD' | 'CAD' = 'EUR';
  let dutyOfCareOwed = false;
  let dutyOfCareHotel = false;
  let dutyOfCareMeals = false;
  let dutyOfCareTransport = false;
  let reroutingOwed = false;
  let refundOwed = false;
  let regulatoryNote = '';

  const jurisdiction = pax.jurisdiction || 'Other';

  if (jurisdiction === 'EU' || jurisdiction === 'EU261') {
    if (!isExtraordinaryCircumstance && isControllableCause && delayHours >= 3) {
      cashCompensationOwed = true;
      const distanceRule = pax.haul === 'Short' ? 250 : pax.haul === 'Medium' ? 500 : 1500;
      cashCompensationAmount = distanceRule <= 1500 ? 250 : distanceRule <= 3500 ? 400 : 600;
      regulatoryNote = `EU261: €${cashCompensationAmount} compensation due (non-extraordinary, ${delayHours}h delay)`;
    }
    dutyOfCareOwed = true;
    dutyOfCareHotel = pax.timing === 'Overnight' || (delayHours >= 5 && delayHours < 8);
    dutyOfCareMeals = delayHours >= 2;
    dutyOfCareTransport = delayHours >= 5;
    reroutingOwed = true;
    refundOwed = pax.disruptionType === 'CANCELLATION' && delayHours >= 2;
  } else if (jurisdiction === 'UK261') {
    if (!isExtraordinaryCircumstance && isControllableCause && delayHours >= 3) {
      cashCompensationOwed = true;
      const distanceRule = pax.haul === 'Short' ? 250 : pax.haul === 'Medium' ? 500 : 1500;
      cashCompensationAmount = distanceRule <= 1500 ? 225 : distanceRule <= 3500 ? 360 : 540;
      cashCompensationCurrency = 'EUR';
      regulatoryNote = `UK261: €${cashCompensationAmount} compensation due`;
    }
    dutyOfCareOwed = true;
    dutyOfCareHotel = pax.timing === 'Overnight' || (delayHours >= 5 && delayHours < 8);
    dutyOfCareMeals = delayHours >= 2;
    dutyOfCareTransport = delayHours >= 5;
    reroutingOwed = true;
    refundOwed = pax.disruptionType === 'CANCELLATION' && delayHours >= 2;
  } else if (jurisdiction === 'USDOT_DOMESTIC') {
    if (delayHours >= 3) {
      cashCompensationOwed = true;
      cashCompensationAmount = Math.min(pax.ticketValue * 0.4, 775);
      cashCompensationCurrency = 'USD';
      regulatoryNote = `US DOT Domestic: $${cashCompensationAmount} required (3h+ delay)`;
    }
    dutyOfCareOwed = delayHours >= 5;
    dutyOfCareMeals = delayHours >= 5;
    dutyOfCareTransport = delayHours >= 5;
    reroutingOwed = true;
    refundOwed = pax.disruptionType === 'CANCELLATION';
  } else if (jurisdiction === 'USDOT_INTERNATIONAL') {
    if (delayHours >= 4) {
      cashCompensationOwed = true;
      cashCompensationAmount = Math.min(pax.ticketValue * 0.5, 1550);
      cashCompensationCurrency = 'USD';
      regulatoryNote = `US DOT International: $${cashCompensationAmount} required (4h+ delay)`;
    }
    dutyOfCareOwed = delayHours >= 8;
    dutyOfCareMeals = delayHours >= 8;
    dutyOfCareTransport = delayHours >= 8;
    dutyOfCareHotel = pax.timing === 'Overnight' && delayHours >= 5;
    reroutingOwed = true;
    refundOwed = pax.disruptionType === 'CANCELLATION';
  } else if (jurisdiction === 'APPR_LARGE') {
    if (!isExtraordinaryCircumstance && delayHours >= 3) {
      cashCompensationOwed = true;
      cashCompensationAmount = pax.haul === 'Short' ? 200 : 300;
      regulatoryNote = `APPR Large Carrier: $${cashCompensationAmount} compensation`;
    }
    dutyOfCareOwed = delayHours >= 4;
    dutyOfCareMeals = delayHours >= 3;
    dutyOfCareHotel = pax.timing === 'Overnight';
    reroutingOwed = true;
  } else if (jurisdiction === 'APPR_SMALL') {
    if (!isExtraordinaryCircumstance && delayHours >= 4) {
      cashCompensationOwed = true;
      cashCompensationAmount = pax.haul === 'Short' ? 100 : 150;
      regulatoryNote = `APPR Small Carrier: $${cashCompensationAmount} compensation`;
    }
    dutyOfCareOwed = delayHours >= 5;
    dutyOfCareMeals = delayHours >= 4;
    dutyOfCareHotel = pax.timing === 'Overnight';
    reroutingOwed = true;
  } else {
    // Other jurisdictions: goodwill only
    dutyOfCareOwed = delayHours >= 3;
    dutyOfCareMeals = delayHours >= 3;
    dutyOfCareHotel = pax.timing === 'Overnight' && delayHours >= 6;
    reroutingOwed = delayHours >= 6;
    regulatoryNote = 'Standard IATA goodwill response';
  }

  const regulatoryAssessment = {
    jurisdiction,
    isControllableCause,
    cashCompensationOwed,
    cashCompensationAmount,
    cashCompensationCurrency,
    dutyOfCareOwed,
    dutyOfCareMeals,
    dutyOfCareHotel,
    dutyOfCareTransport,
    reroutingOwed,
    refundOwed,
    regulatoryNote,
  };

  // ============================================================================
  // LAYER 3: GOODWILL NPS ACTION
  // ============================================================================

  let notificationRequired = true;
  let mealVoucherOffered = false;
  let mealVoucherValue = 0;
  let loungeAccessOffered = false;
  let personalOutreachRequired = false;
  let whatsappMessageType: any = 'NOTIFICATION_ONLY';
  let talkToAgentOption = false;

  if (delayHours < 1.5) {
    // Minimal disruption
    notificationRequired = true;
    whatsappMessageType = 'NOTIFICATION_ONLY';
  } else if (delayHours < 3) {
    // 90-180 minute range
    if (isPremiumCabin) {
      loungeAccessOffered = true;
      whatsappMessageType = 'LOUNGE_ACCESS';
    } else if (isPremiumTier) {
      loungeAccessOffered = true;
      whatsappMessageType = 'LOUNGE_ACCESS';
    } else {
      mealVoucherOffered = true;
      mealVoucherValue = 15;
      whatsappMessageType = 'MEAL_VOUCHER';
    }
  } else if (delayHours < 5) {
    // 180-300 minute range
    mealVoucherOffered = true;
    mealVoucherValue = 25;
    if (isPremiumCabin || isPremiumTier) {
      loungeAccessOffered = true;
    }
    whatsappMessageType = 'MEAL_VOUCHER';
    talkToAgentOption = true;
  } else {
    // 300+ minute range
    personalOutreachRequired = true;
    mealVoucherOffered = true;
    mealVoucherValue = 30;
    talkToAgentOption = true;
    if (isSpecialNeeds || priorityTier <= 2) {
      whatsappMessageType = 'REBOOK_PENDING';
    } else {
      whatsappMessageType = 'HOTEL_ARRANGED';
    }
  }

  const goodwillAction = {
    notificationRequired,
    mealVoucherOffered,
    mealVoucherValue,
    loungeAccessOffered,
    personalOutreachRequired,
    whatsappMessageType,
    talkToAgentOption,
  };

  // ============================================================================
  // LAYER 4: RECOVERY ROUTING
  // ============================================================================

  let primaryAction: any = 'NOTIFICATION_ONLY';
  let rebookEligible = false;
  let rebookCarrierOrder: ('SAME_METAL' | 'PARTNER' | 'INTERLINE')[] = [];
  let hotelRequired = false;
  let mealsRequired = false;
  let loungeRequired = false;
  let acceptableRebookWindow: any = 'SAME_DAY';
  let offerRefundAlternative = false;
  let requiresAgentIntervention = false;
  let agentInterventionReason: string | undefined;

  // Determine rebook eligibility and carrier order
  if (delayHours >= 3 && pax.disruptionType === 'CANCELLATION') {
    rebookEligible = true;
    rebookCarrierOrder = ['SAME_METAL', 'PARTNER', 'INTERLINE'];
    acceptableRebookWindow = delayHours >= 12 ? 'NEXT_DAY' : 'SAME_DAY';
    offerRefundAlternative = true;
    mealsRequired = true;
    if (pax.timing === 'Overnight') {
      hotelRequired = true;
    }
  } else if (delayHours >= 5) {
    rebookEligible = true;
    const inventoryConfidence = pax.inventoryConfidenceScore ?? 0.9;
    if (inventoryConfidence >= 0.8 && pax.internalSeatAvailable) {
      rebookCarrierOrder = ['SAME_METAL', 'PARTNER', 'INTERLINE'];
    } else if (pax.partnerSeatAvailable) {
      rebookCarrierOrder = ['PARTNER', 'SAME_METAL', 'INTERLINE'];
    } else {
      rebookCarrierOrder = ['INTERLINE', 'PARTNER', 'SAME_METAL'];
    }
    acceptableRebookWindow = delayHours >= 12 ? 'NEXT_DAY' : 'SAME_DAY';
    mealsRequired = true;
    if (pax.timing === 'Overnight') {
      hotelRequired = true;
    }
  } else if (delayHours >= 1.5 && delayHours < 5) {
    if (isPremiumCabin || isPremiumTier) {
      loungeRequired = true;
    } else {
      mealsRequired = true;
    }
  }

  // Determine primary action
  if (isSpecialNeeds) {
    requiresAgentIntervention = true;
    agentInterventionReason = `Special needs passenger (${pax.ssrCode}) requires agent review`;
    if (rebookEligible) {
      primaryAction = 'REBOOK_SAME_METAL';
    } else if (mealsRequired || hotelRequired) {
      primaryAction = 'MEAL_VOUCHER';
    } else {
      primaryAction = 'NOTIFICATION_ONLY';
    }
  } else if (rebookEligible) {
    if (rebookCarrierOrder[0] === 'SAME_METAL') {
      primaryAction = 'REBOOK_SAME_METAL';
    } else if (rebookCarrierOrder[0] === 'PARTNER') {
      primaryAction = 'REBOOK_PARTNER';
    } else {
      primaryAction = 'REBOOK_INTERLINE';
    }
    if (hotelRequired) {
      primaryAction = 'REBOOK_AND_HOTEL';
    }
    if (pax.cabin === 'Business' && delayHours >= 5) {
      requiresAgentIntervention = true;
      agentInterventionReason = 'Premium cabin passenger in severe delay - confirm downgrade consent';
      pax.downgradeOffered = true;
      pax.rebookConsentRequired = true;
    }
  } else if (loungeRequired) {
    primaryAction = 'LOUNGE_ACCESS';
  } else if (mealsRequired) {
    primaryAction = 'MEAL_VOUCHER';
  } else {
    primaryAction = 'NOTIFICATION_ONLY';
  }

  if (priorityTier === 1 && (rebookEligible || mealsRequired)) {
    requiresAgentIntervention = true;
    agentInterventionReason = 'Critical priority passenger requires agent attention';
  }

  const recoveryDecision = {
    primaryAction,
    rebookEligible,
    rebookCarrierOrder,
    hotelRequired,
    mealsRequired,
    loungeRequired,
    acceptableRebookWindow,
    offerRefundAlternative,
    requiresAgentIntervention,
    agentInterventionReason,
  };

  // ============================================================================
  // COST BREAKDOWN & FINANCIAL EXPOSURE
  // ============================================================================

  let legacyDutyOfCare = 0;
  if (pax.timing === 'Overnight' && hotelRequired) {
    legacyDutyOfCare = pax.hotelCost;
  } else if (mealsRequired) {
    legacyDutyOfCare = 25;
  } else if (delayHours >= 2) {
    legacyDutyOfCare = 15;
  }

  const eu261 = cashCompensationOwed ? cashCompensationAmount : 0;
  const usDot = cashCompensationCurrency === 'USD' && cashCompensationOwed ? cashCompensationAmount : 0;
  const churnPenalty = isPremiumCabin || isPremiumTier ? 1200 : 300;

  const legacyTotal = legacyDutyOfCare + eu261 + usDot + churnPenalty;
  const legacy: CostBreakdown = {
    dutyOfCare: legacyDutyOfCare,
    eu261,
    usDot,
    churnPenalty,
    total: legacyTotal,
  };

  // Aero agent cost
  let aeroAgentCostRaw = 0;
  if (primaryAction.includes('REBOOK_SAME_METAL')) {
    aeroAgentCostRaw = pax.ticketValue * 1.2 + (hotelRequired ? pax.hotelCost + 40 : 0);
  } else if (primaryAction.includes('REBOOK_PARTNER')) {
    aeroAgentCostRaw = pax.ticketValue * 1.5 + (hotelRequired ? pax.hotelCost + 40 : 0);
  } else if (primaryAction.includes('REBOOK_INTERLINE')) {
    aeroAgentCostRaw = pax.oalCost + (hotelRequired ? pax.hotelCost + 40 : 0) + 150;
  } else if (primaryAction === 'REBOOK_AND_HOTEL') {
    aeroAgentCostRaw = pax.ticketValue * 1.2 + pax.hotelCost + 40;
  } else if (primaryAction === 'LOUNGE_ACCESS') {
    aeroAgentCostRaw = 35;
  } else if (primaryAction === 'MEAL_VOUCHER') {
    aeroAgentCostRaw = mealVoucherValue || 20;
  } else if (primaryAction === 'NOTIFICATION_ONLY') {
    aeroAgentCostRaw = 0.1;
  }

  const aeroAgentCost = Math.round(aeroAgentCostRaw * 10) / 10;
  const netSavings = legacyTotal - aeroAgentCost;

  // CLV and churn metrics
  const clv = isPremiumCabin || isPremiumTier
    ? 20000 + Math.random() * 10000
    : 3000 + Math.random() * 4000;
  const churnPropensity = isPremiumCabin || isPremiumTier
    ? 0.08 + Math.random() * 0.08
    : 0.05 + Math.random() * 0.1;

  const eu261Max = cashCompensationOwed ? cashCompensationAmount : 0;
  const eu261Likelihood = cashCompensationOwed ? 0.4 + Math.random() * 0.4 : 0;
  const eu261EV = eu261Max * eu261Likelihood;
  const churnEV = clv * churnPropensity;
  const totalEV = legacyDutyOfCare + eu261EV + usDot + churnEV;

  // Recommended action mapping for backward compatibility
  const recommendedAction: ActionType = primaryAction === 'NOTIFICATION_ONLY'
    ? 'Original Flight Maintained + Notification Only'
    : primaryAction === 'LOUNGE_ACCESS'
      ? 'Original Flight Maintained + Lounge Access Issued'
      : primaryAction === 'MEAL_VOUCHER'
        ? 'Original Flight Maintained + Meal Voucher Issued'
        : primaryAction === 'REBOOK_SAME_METAL'
          ? 'Same Metal Recovery + Hotel & Meal Vouchers'
          : primaryAction === 'REBOOK_PARTNER'
            ? 'Partner Metal Recovery + Hotel & Meal Vouchers'
            : primaryAction === 'REBOOK_INTERLINE'
              ? 'Interline Metal Recovery + Hotel & Meal Vouchers'
              : 'Manual Handling Required';

  const suggestedStatus: PaxStatus = requiresAgentIntervention
    ? 'pending_validation'
    : isSpecialNeeds
      ? 'pending_validation'
      : 'auto_processed';

  const rationale = `Priority Tier ${priorityTier} (${distressLevel}). ${regulatoryNote || 'Standard handling.'} Action: ${primaryAction}.`;
  const valueTag = isPremiumCabin ? '🏆 Premium Care' : distressLevel === 'Critical' ? '🆘 High Touch' : '🏨 Cost Optimized';

  const liabilityEngine: DisruptionLiabilityEngine = {
    jurisdiction: {
      primaryFramework: `[${jurisdiction} Applicable]`,
    },
    itinerary: {
      status: rebookEligible ? 'Rebooked' : 'Delayed',
      newFlight: rebookCarrierOrder.includes('INTERLINE')
        ? pax.oalFlightNumber
        : pax.flightNumber,
      newETD: rebookEligible ? 'Tomorrow, 10:00 Local' : 'Today, 14:00 Local',
      newSeat: '4A',
      isSameMetal: rebookCarrierOrder[0] === 'SAME_METAL',
    },
    dutyOfCare: {
      hotel: {
        eligible: hotelRequired || dutyOfCareHotel,
        provider: 'Clarion Hotel Helsinki Airport',
      },
      meals: {
        eligible: mealsRequired || dutyOfCareMeals,
        voucherValue: mealsRequired ? mealVoucherValue || 25 : dutyOfCareMeals ? 20 : 0,
      },
      transport: {
        eligible: hotelRequired || dutyOfCareTransport,
        type: 'Standard Shuttle',
      },
      lounge: {
        eligible: loungeRequired,
        name: isPremiumTier ? 'Finnair Platinum Wing' : 'Finnair Business Lounge',
      },
    },
    financialExposure: {
      dutyOfCare: {
        local: legacyDutyOfCare,
        breakdown: rebookEligible
          ? `Rebook (€${aeroAgentCostRaw}) + Hotel (€${hotelRequired ? pax.hotelCost : 0})`
          : `Meals (€${mealsRequired ? mealVoucherValue : 0})`,
      },
      eu261: {
        ev: eu261EV,
        max: eu261Max,
        likelihood: eu261Likelihood,
      },
      churn: {
        ev: churnEV,
        clv,
        propensity: churnPropensity,
      },
      totalAero: {
        ev: aeroAgentCost,
      },
      deterministic: {
        oalRebook: pax.oalCost,
        dutyOfCare: legacyDutyOfCare,
      },
      predictive: {
        expectedEU261: eu261EV,
        expectedChurn: churnEV,
      },
      optimizedPath: {
        label: primaryAction.toUpperCase(),
        color: '#0d9488',
        bgColor: '#ccfbf1',
      },
    },
  };

  return {
    isVIP: isPremiumCabin || isPremiumTier,
    isOALEligible: isPremiumCabin || isPremiumTier || isSpecialNeeds,
    legacy,
    internal: {
      dutyOfCare: hotelRequired ? pax.hotelCost + 40 : mealsRequired ? 25 : 0,
      fare: pax.ticketValue * 2.5,
      total: (pax.ticketValue * 2.5) + (hotelRequired ? pax.hotelCost + 40 : 0),
    },
    recommendedAction,
    suggestedStatus,
    valueTag,
    aeroAgentCost,
    netSavings,
    rationale,
    eu261Max,
    eu261Likelihood,
    eu261EV,
    clv,
    churnPropensity,
    churnEV,
    totalEV,
    liabilityEngine,
  };
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
  const flightInfo = `${pax.flightNumber} ${pax.origin}→${pax.destination}`;
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
    case 'REBOOK':
      messageType = 'rebook_confirmed';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've rebooked you on the next available flight with the same cabin class. Check your email for the new booking details for flight ${flightInfo}. Reply with HELP if you need anything.`;
      includedElements.push('recovery_action');
      break;

    case 'REBOOK_ALT_AIRLINE':
      messageType = 'rebook_pending';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We're arranging a rebooking on an alternative airline. You'll receive details shortly. Please check your email and be ready to board. Reply with HELP if you have questions.`;
      includedElements.push('recovery_action');
      break;

    case 'REFUND':
      messageType = 'escalation';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We're processing a full refund to your original payment method within 7 days. Thank you for your patience. Reply with HELP if you need assistance right now.`;
      includedElements.push('recovery_action');
      break;

    case 'HOTEL':
      messageType = 'hotel';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've arranged a hotel stay for you tonight at a partner property near the airport. Use the link in your confirmation email to check in. Meals covered. Reply with HELP if you need support.`;
      includedElements.push('recovery_action');
      qrCodeRequired = true;
      qrCodeType = 'ticket';
      break;

    case 'LOUNGE':
      messageType = 'lounge';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We've given you complimentary lounge access while you wait. Scan the QR below to enter. Enjoy refreshments and comfortable seating. [QR CODE PLACEHOLDER]`;
      includedElements.push('recovery_action', 'qr_code');
      qrCodeRequired = true;
      qrCodeType = 'lounge';
      break;

    case 'MEALS':
      messageType = 'meal_voucher';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. We're providing meal vouchers for you and your travel party. Scan the QR code below to redeem at airport restaurants. [QR CODE PLACEHOLDER]`;
      includedElements.push('recovery_action', 'qr_code');
      qrCodeRequired = true;
      qrCodeType = 'voucher';
      break;

    case 'COMPENSATION':
      messageType = 'escalation';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. You qualify for compensation under EU261/2004 (€250-400). This will be processed separately to your registered email. Reply with HELP if you have questions.`;
      includedElements.push('recovery_action');
      break;

    default:
      messageType = 'notification_only';
      message = `Hi ${paxName}, we sincerely apologize that ${delayText}. Our team is working to resolve this. We'll update you shortly with next steps. Reply with HELP if you need immediate assistance.`;
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

    const tone = toneToDiagnostics[result.distressLevel] || 'neutral';

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
}

export async function computeEngineAI(
  pax: Passenger,
  actionOverride?: ActionType
): Promise<AnalysisResult> {
  const timestamp = new Date().toISOString();

  // Step 1: Run rule engine first
  const ruleResult = computeEngineLocal(pax, actionOverride);

  try {
    // Step 2: Call Claude API with new payload structure
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const responseData = await response.json() as { data: GateAgentClaudeResponse };
    const data = responseData.data;

    console.log(
      `[${timestamp}] Claude AI Analysis | PNR: ${pax.pnr} | useCase: gate-agent | Source: Claude API`
    );

    // Step 3: Merge Claude response into rule engine result
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
      aiAgentTalkingPoints: data.agentTalkingPoints ?? []
    };
  } catch (error) {
    const timestamp2 = new Date().toISOString();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(
      `[${timestamp2}] Claude AI Analysis Failed | PNR: ${pax.pnr} | useCase: gate-agent | Source: Local Fallback | Error: ${errorMsg}`
    );

    // Silent fallback to rule engine
    return {
      ...ruleResult,
      aiPowered: false
    };
  }
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
            primaryAction: result.recoveryDecision.primaryAction,
            mealVoucher: result.goodwillAction.mealVoucherOffered,
            loungeAccess: result.goodwillAction.loungeAccessOffered,
            hotelArranged: result.recoveryDecision.hotelRequired,
            rebookEligible: result.recoveryDecision.rebookEligible
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
      whatWasArranged: [result.recoveryDecision.primaryAction],
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
  if (result.distressLevel === 'Critical' && result.recoveryDecision.requiresAgentIntervention) {
    complianceStatus = 'Review Required';
    auditRiskLevel = 'High';
  } else if (result.recoveryDecision.requiresAgentIntervention) {
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
            rebookEligible: result.recoveryDecision.rebookEligible,
            hotelRequired: result.recoveryDecision.hotelRequired,
            mealsRequired: result.recoveryDecision.mealsRequired,
            loungeRequired: result.recoveryDecision.loungeRequired,
            offerRefundAlternative: result.recoveryDecision.offerRefundAlternative,
            requiresAgentIntervention: result.recoveryDecision.requiresAgentIntervention
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

// Default export: synchronous rule-based engine for seed generation
export const computeEngine = computeEngineLocal;
