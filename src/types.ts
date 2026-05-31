export { cn } from './lib/utils';

export type CabinClass = 'Economy' | 'Premium Economy' | 'Business' | 'First' | 'F' | 'J';
export type LoyaltyTier = 'Basic' | 'Silver' | 'Gold' | 'Platinum' | 'Platinum Lumo' | 'oneworld Emerald' | 'Standard' | 'None';
export type HaulType = 'Short' | 'Medium' | 'Long';
export type TimingType = 'Day' | 'Overnight';
export type Jurisdiction = 'EU' | 'US' | 'Other' | 'EU261' | 'UK261' | 'USDOT_DOMESTIC' | 'USDOT_INTERNATIONAL' | 'APPR_LARGE' | 'APPR_SMALL';
export type DisruptionReason = 'Crew Scheduling' | 'Late Inbound' | 'Weather' | 'Technical' | 'ATC' | 'TECHNICAL' | 'OPERATIONAL' | 'WEATHER' | 'STRIKE_AIRLINE' | 'STRIKE_EXTERNAL' | 'SECURITY';
export type DisruptionType = 'DELAY' | 'CANCELLATION';
export type DisruptionCause = 'TECHNICAL' | 'OPERATIONAL' | 'WEATHER' | 'ATC' | 'SECURITY' | 'STRIKE_AIRLINE' | 'STRIKE_EXTERNAL';
export type SSRCode = 'WCHR' | 'MEDA' | 'UMNR' | 'BLND' | 'DEAF' | 'WCHC' | 'WCHS' | 'DPNA' | 'MAAS' | '';
export type ActionType =
  | 'Priority Concierge Triage'
  | 'Original Flight Maintained + Notification Only'
  | 'Original Flight Maintained + Lounge Access Issued'
  | 'Original Flight Maintained + Meal Voucher Issued'
  | 'Same Metal Recovery'
  | 'Same Metal Recovery + Hotel & Meal Vouchers'
  | 'Partner Metal Recovery'
  | 'Partner Metal Recovery + Hotel & Meal Vouchers'
  | 'Interline Metal Recovery + Hotel & Meal Vouchers'
  | 'Alternative Flight + Hotel'
  | 'Alternative Flight Only'
  | 'Manual Handling Required'
  | 'Premium Recovery Option'
  | 'Manual Override'
  | 'Notification Only'
  | 'Meal Voucher'
  | 'Lounge Access'
  | 'Hotel and Meal Vouchers';

export type PaxStatus = 'pending_triage' | 'pending_validation' | 'resolved' | 'auto_processed' | 'escalated';
export type RecoveryPrimaryAction =
  | 'NOTIFICATION_ONLY'
  | 'MEAL_VOUCHER'
  | 'LOUNGE_ACCESS'
  | 'REBOOK_SAME_METAL'
  | 'REBOOK_PARTNER'
  | 'REBOOK_INTERLINE'
  | 'HOTEL_AND_MEALS'
  | 'REBOOK_AND_HOTEL'
  | 'FULL_REFUND'
  | 'DOWNGRADE_WITH_REFUND'
  | 'ESCALATE_TO_AGENT';
export type WhatsappMessageType =
  | 'NOTIFICATION_ONLY'
  | 'MEAL_VOUCHER'
  | 'LOUNGE_ACCESS'
  | 'HOTEL_ARRANGED'
  | 'REBOOK_PENDING'
  | 'REBOOK_CONFIRMED'
  | 'DOWNGRADE_CONSENT';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Passenger {
  uid: string;
  pnr: string;
  name: string;
  cabin: CabinClass;
  tier: LoyaltyTier;
  flightNumber: string;
  origin: string;
  destination: string;
  haul: HaulType;
  timing: TimingType;
  scheduledDeparture: string;
  scheduledArrival: string;
  estimatedArrival: string;
  jurisdiction: Jurisdiction;
  disruptionReason: DisruptionReason;
  delayHours: number;
  ticketValue: number;
  hotelCost: number;
  oalCost: number;
  oalFlightNumber: string;
  baseEU261Comp: number;
  internalSeatAvailable: boolean;
  partnerSeatAvailable: boolean;
  internalWaitHours: number;
  ssrCode: SSRCode;
  partySize: number;
  inventoryConfidenceScore?: number;

  // New engine fields
  loyaltyTier?: 'Platinum' | 'Gold' | 'Silver' | 'Standard' | 'None';
  disruptionType?: DisruptionType;
  disruptionCause?: DisruptionCause;
  delayMinutes?: number;
  carrierSize?: 'large' | 'small';
  hasConnection?: boolean;
  connectionBufferMinutes?: number;
  travelPartySize?: number;
  hasInfant?: boolean;
  rebookStatus?: 'pending' | 'confirmed' | 'declined' | 'waitlisted';
  rebookConsentRequired?: boolean;
  downgradeOffered?: boolean;
  downgradeAccepted?: boolean;

  status: PaxStatus;
  isEscalated?: boolean;
  escalationReason?: string;
  escalatedAt?: string;
  handoffBriefing?: HandoffBriefing;
  auditNarrative?: AuditNarrative;
  overrideAction?: ActionType;
  overrideRationale?: string;

  chatState: 'initial' | 'rebooked' | 'hotel' | 'escalated' | 'voucher' | 'info_only' | 'plan_sent' | 'acknowledged' | 'accepted';
  messages?: ChatMessage[];
  queuePosition?: number;
  analysis?: AnalysisResult;
  portalOnly?: boolean;
}

export interface CostBreakdown {
  dutyOfCare: number;
  eu261: number;
  usDot: number;
  churnPenalty: number;
  total: number;
  oalRebookCost?: number;
  mealVoucherCost?: number;
  hotelCost?: number;
  loungeCost?: number;
  compensationCost?: number;
  extraordinaryCircumstancesSaving?: number;
}

// MOD 3: Recovery Option for multiple recovery alternatives
export interface RecoveryOption {
  id: string; // e.g., 'option-1', 'option-2', 'option-3'
  title: string; // e.g., 'Next Available Flight', 'Premium Rebook', 'Refund'
  description: string; // One sentence summary
  primaryAction: ActionType;
  costToAeroAgent: number;
  passengerValue: string; // e.g., "€250 voucher + Lounge access"
  timeline: string; // e.g., "Departing 3 hours", "By morning"
  regulatoryBasis: string; // e.g., "EU261 Article 7", "Goodwill"
  suitabilityReason: string; // Why this option fits this passenger
  flaggedConcerns?: string[]; // Any downsides or risks
}

export interface AnalysisResult {
  isVIP: boolean;
  isOALEligible: boolean;
  legacy: CostBreakdown;
  internal: {
    dutyOfCare: number;
    fare: number;
    total: number;
  };
  recommendedAction: ActionType;
  suggestedStatus: PaxStatus;
  valueTag: string;
  aeroAgentCost: number;
  netSavings: number;
  rationale: string;
  distressReason?: string;
  distressLevel?: string;
  eu261Max: number;
  eu261Likelihood: number;
  eu261EV: number;
  clv: number;
  churnPropensity: number;
  churnEV: number;
  totalEV: number;
  extraordinaryCircumstancesSaving?: number;
  regulatorySavingsPercent?: number;
  regulatoryBasis?: string;
  liabilityEngine?: DisruptionLiabilityEngine;
  recoveryDecision?: {
    primaryAction?: RecoveryPrimaryAction;
    rebookEligible: boolean;
    rebookCarrierOrder?: ('SAME_METAL' | 'PARTNER' | 'INTERLINE')[];
    hotelRequired: boolean;
    mealsRequired: boolean;
    loungeRequired: boolean;
    acceptableRebookWindow?: 'SAME_DAY' | 'NEXT_DAY';
    offerRefundAlternative: boolean;
    requiresAgentIntervention: boolean;
    agentInterventionReason?: string;
  };
  goodwillAction?: {
    notificationRequired?: boolean;
    mealVoucherOffered?: boolean;
    mealVoucherValue?: number;
    loungeAccess?: boolean;
    loungeAccessOffered?: boolean;
    personalOutreachRequired?: boolean;
    whatsappMessageType?: WhatsappMessageType;
    talkToAgentOption?: boolean;
    compensation?: number;
  };
  cashCompensationAmount?: number;
  aiJustification?: string;
  aiDistressLevel?: 'Critical' | 'High' | 'Medium' | 'Low';
  aiDistressReason?: string;
  aiRegulatoryBasis?: string;
  aiRegulatoryNote?: string;
  aiPriorityScore?: number;
  aiFlaggedIssues?: string[];
  aiAgentTalkingPoints?: string[];
  aiPowered?: boolean;
  aiUnavailable?: boolean;
  aiPoweredError?: string;
  recoveryOptions?: RecoveryOption[]; // MOD 3: Multiple recovery alternatives
}

export interface WhatsAppMessage {
  message: string;
  messageType: string;
  tone: 'neutral' | 'apologetic' | 'empathetic' | 'urgent';
  includedElements: string[];
  qrCodeRequired: boolean;
  qrCodeType: 'voucher' | 'lounge' | 'ticket' | null;
  generatedAt: string;
  passengerPnr: string;
  aiPowered: boolean;
}

export interface HandoffBriefing {
  summary: string;
  passengerConcern: string;
  emotionalState: 'Frustrated' | 'Anxious' | 'Angry' | 'Distressed' | 'Calm' | 'Resigned';
  urgencyLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  whatWasArranged: string[];
  suggestedOpeningLine: string;
  sensitiveIssues: string[];
  recommendedAction: string;
  estimatedResolutionTime: '5 mins' | '10 mins' | '15 mins' | '30 mins+';
  generatedAt: string;
  passengerPnr: string;
  conversationLength: number;
  // Optional fields from passenger-chat escalation
  keyDetails?: string[];
  urgencyFlag?: boolean;
  preferredResolution?: string;
  conversationSummary?: string;
  stressSignals?: string[];
  distressLevel?: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface AuditNarrative {
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
  generatedAt: string;
  passengerPnr: string;
  aiPowered: boolean;
}

export interface DisruptionLiabilityEngine {
  jurisdiction: {
    primaryFramework: string;
  };
  itinerary: {
    status: 'Rebooked' | 'Delayed' | 'Cancelled';
    newFlight?: string;
    newETD?: string;
    newSeat?: string;
    isSameMetal: boolean;
  };
  dutyOfCare: {
    hotel: { eligible: boolean; provider?: string };
    meals: { eligible: boolean; voucherValue: number };
    transport: { eligible: boolean; type: string };
    lounge?: { eligible: boolean; name?: string };
  };
  financialExposure: {
    dutyOfCare: {
      local: number;
      breakdown: string;
    };
    eu261: {
      ev: number;
      max: number;
      likelihood: number;
    };
    churn: {
      ev: number;
      clv: number;
      propensity: number;
    };
    totalAero: {
      ev: number;
    };
    deterministic: {
      oalRebook: number;
      dutyOfCare: number;
    };
    predictive: {
      expectedEU261: number;
      expectedChurn: number;
    };
    optimizedPath: {
      label: string;
      color: string;
      bgColor: string;
    };
  };
}
