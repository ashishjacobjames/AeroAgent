// ============================================================================
// AeroAgent Financial Constants
// Single source of truth for all financial thresholds, rates, and multipliers.
// Imported by engine.ts, App.tsx, and passengerTemplates.ts.
// ============================================================================

// ── Duty of Care ─────────────────────────────────────────────────────────────
export const MEAL_VOUCHER_RATE              = 20;   // €20 per pax (EU261 Art. 9)
export const HOTEL_RATE_PER_NIGHT          = 195;  // €195 per night
export const HOTEL_TRANSFER                = 30;   // €30 ground transfer
export const OVERNIGHT_THRESHOLD_MINUTES   = 480;  // 8h — canonical overnight stranding

// ── EU261 Cash Compensation ───────────────────────────────────────────────────
export const EU261_SHORT_HAUL_AMOUNT       = 250;  // < 1500 km
export const EU261_MEDIUM_HAUL_AMOUNT      = 400;  // 1500–3500 km
export const EU261_LONG_HAUL_AMOUNT        = 600;  // > 3500 km
export const EU261_SHORT_MEDIUM_THRESHOLD  = 180;  // ≥3h arrival delay (Art. 7, short/medium)
export const EU261_LONG_THRESHOLD          = 240;  // ≥4h arrival delay (Art. 7, long haul)
export const EU261_MEALS_SHORT_THRESHOLD   = 120;  // ≥2h departure delay (Art. 9, short haul)

// ── Haul Distances ────────────────────────────────────────────────────────────
export const SHORT_HAUL_MAX_KM             = 1500;
export const MEDIUM_HAUL_MAX_KM            = 3500;

// ── Customer Lifetime Value ───────────────────────────────────────────────────
export const CLV_HORIZON_YEARS             = 2;    // 2-year CLV horizon

export const CLV_BASE_ECONOMY              = 600;
export const CLV_BASE_PREMIUM_ECONOMY      = 1200;
export const CLV_BASE_BUSINESS             = 2800;
export const CLV_BASE_FIRST                = 5500;

export const CLV_TIER_BASIC                = 1.0;
export const CLV_TIER_SILVER               = 1.3;
export const CLV_TIER_GOLD                 = 1.6;
export const CLV_TIER_PLATINUM             = 2.0;
export const CLV_TIER_EMERALD              = 2.5;

// ── Churn Rates ───────────────────────────────────────────────────────────────
export const CHURN_BASE_CANCELLED          = 0.14;
export const CHURN_BASE_8H_PLUS            = 0.10;
export const CHURN_BASE_4_TO_8H            = 0.06;
export const CHURN_BASE_2_TO_4H            = 0.03;
export const CHURN_BASE_UNDER_2H           = 0.01;

export const CHURN_TRADITIONAL_MULTIPLIER  = 1.4;  // Trad churn = base × 1.4
export const CHURN_TRADITIONAL_CAP         = 0.25; // Cap at 25%
export const CHURN_SAVING_CAP_PCT          = 0.15; // Loyalty saving capped at 15% of CLV
export const CHURN_FLOOR                   = 0.01; // AeroAgent churn floor

export const CHURN_REDUCTION_SILVER        = 0.005;
export const CHURN_REDUCTION_GOLD          = 0.01;
export const CHURN_REDUCTION_PLATINUM      = 0.015;
export const CHURN_REDUCTION_EMERALD       = 0.02;

// ── Operational Costs ─────────────────────────────────────────────────────────
export const OAL_COST                      = 450;  // OAL/interline rebook (per booking)
export const CONNECTION_COST_TRADITIONAL   = 180;  // Reactive connection miss handling
export const CONNECTION_COST_AEROAGENT     = 120;  // Proactive earlier rebook
export const SPECIAL_NEEDS_COST_TRADITIONAL = 60;  // Manual SSR coordination
export const SPECIAL_NEEDS_COST_AEROAGENT  = 25;  // Auto-coordinated SSR

export const REBOOKING_TRADITIONAL_MULTIPLIER = 0.55; // Last-minute walk-up rate (55% of ticket)
export const REBOOKING_AEROAGENT_MULTIPLIER   = 0.38; // Pre-negotiated rate   (38% of ticket)
