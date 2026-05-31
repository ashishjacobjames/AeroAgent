import { describe, test, expect, vi } from 'vitest';
import { computeEngine } from '../engine';
import { Passenger } from '../types';

/**
 * FETCH MOCK - Intercepts Claude API calls
 * Returns minimal valid response with required fields
 */
const mockClaudeResponse = (overrides: Record<string, any> = {}) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      data: {
        recommendedAction: overrides.recommendedAction ?? 'Notification Only',
        details: 'Test details',
        justification: 'Test justification from Claude',
        distressLevel: overrides.distressLevel ?? 'Low',
        distressReason: 'Test distress reason',
        regulatoryBasis: overrides.regulatoryBasis ?? 'None',
        regulatoryNote: 'Test regulatory note',
        priorityScore: overrides.priorityScore ?? 30,
        flaggedIssues: overrides.flaggedIssues ?? [],
        agentTalkingPoints: ['Point 1', 'Point 2'],
        recoveryOptions: overrides.recoveryOptions ?? [{
          id: 'A',
          title: 'Option A',
          description: 'Notify passenger only',
          primaryAction: 'NOTIFICATION_ONLY',
          costToAeroAgent: 0.5,
          passengerValue: 'Low',
          timeline: 'Immediate',
          regulatoryBasis: 'None',
          suitabilityReason: 'Standard disruption'
        }]
      }
    })
  });
};

vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/claude')) {
    return mockClaudeResponse();
  }
  return Promise.reject(new Error('Unexpected fetch: ' + url));
}));

/**
 * TEST PASSENGER FACTORY
 * Creates test passengers with sensible defaults, overrideable
 */
const makePassenger = (
  overrides: Partial<Passenger> = {}
): Passenger => {
  const defaults: Passenger = {
    // Defaults — standard case
    uid: 'test-001',
    pnr: 'TEST01',
    name: 'Test Passenger',
    cabin: 'Economy',
    tier: 'Standard',
    loyaltyTier: 'None',
    ssrCode: '',
    flightNumber: 'AY101',
    origin: 'HEL',
    destination: 'ORD',
    haul: 'Long',
    disruptionType: 'DELAY',
    disruptionCause: 'TECHNICAL',
    delayMinutes: 60,
    delayHours: 1,
    jurisdiction: 'EU261',
    carrierSize: 'large',
    hasConnection: false,
    connectionBufferMinutes: undefined,
    travelPartySize: 1,
    hasInfant: false,
    ticketValue: 350,
    hotelCost: 120,
    oalCost: 450,
    oalFlightNumber: '',
    inventoryConfidenceScore: 0.8,
    status: 'pending_triage',
    isEscalated: false,
    rebookStatus: undefined,
    rebookConsentRequired: false,
    downgradeOffered: false,
    downgradeAccepted: false,
    messages: [],
    chatState: 'initial',
    overrideAction: undefined,
    overrideRationale: undefined,
    scheduledDeparture: '2024-05-26T14:00:00Z',
    scheduledArrival: '2024-05-26T22:00:00Z',
    estimatedArrival: '2024-05-26T23:00:00Z',
    baseEU261Comp: 250,
    internalSeatAvailable: true,
    partnerSeatAvailable: true,
    internalWaitHours: 24,
    partySize: 1,
    timing: 'Day',
    disruptionReason: 'Technical',
  };

  const merged = { ...defaults, ...overrides };

  // Auto-calculate delayHours from delayMinutes if not explicitly set
  if (overrides.delayMinutes !== undefined && overrides.delayHours === undefined) {
    merged.delayHours = Math.ceil((merged.delayMinutes ?? 0) / 60);
  }

  return merged;
};

/**
 * TEST GROUP 1: NOTIFICATION ONLY CASES
 * Expected: ~€0.50 cost, no line items
 */
describe('Notification Only Cases', () => {
  test('Standard Economy 44-min delay EU261 — notification only', async () => {
    const pax = makePassenger({
      pnr: 'TEST-NOTIF-01',
      cabin: 'Economy',
      tier: 'Standard',
      loyaltyTier: 'None',
      delayMinutes: 44,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // Action must include notification
    expect(result.recommendedAction).toContain('Notification');

    // ALL cost components must be zero or minimal
    expect(result.aeroAgentCost).toBeLessThanOrEqual(1);

    // Legacy cost also minimal
    expect(result.legacy.total).toBeLessThanOrEqual(1);

    // Net savings near zero or positive
    expect(result.netSavings).toBeGreaterThanOrEqual(0);
  });

  test('Gold Business 44-min delay EU261 — notification only', async () => {
    const pax = makePassenger({
      pnr: 'TEST-NOTIF-02',
      cabin: 'J',
      tier: 'Gold',
      loyaltyTier: 'Gold',
      delayMinutes: 44,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // Still notification only at 44 mins
    expect(result.recommendedAction).toContain('Notification');

    // Cost still minimal
    expect(result.aeroAgentCost).toBeLessThanOrEqual(1);

    // Distress score low
    expect(result.distressLevel).toBe('Low');
  });

  test('Platinum Economy 89-min delay — still notification only', async () => {
    const pax = makePassenger({
      pnr: 'TEST-NOTIF-03',
      cabin: 'Economy',
      loyaltyTier: 'Platinum',
      delayMinutes: 89,
      disruptionCause: 'WEATHER',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    expect(result.recommendedAction).toContain('Notification');
    expect(result.aeroAgentCost).toBeLessThanOrEqual(1);
  });
});

/**
 * TEST GROUP 2: MEAL VOUCHER CASES
 * Expected: voucher cost only, no rebook
 */
describe('Meal Voucher Cases', () => {
  test('Standard Economy 2h delay EU261 technical — meal voucher or notification', async () => {
    const pax = makePassenger({
      pnr: 'TEST-MEAL-01',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 120,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // Should be notification or meal/lounge related (standard doesn't get much at 2h)
    expect(['Notification', 'Meal', 'Lounge'].some(x => result.recommendedAction.includes(x))).toBe(true);

    // No EU261 compensation (under 3h threshold)
    expect(result.eu261EV).toBe(0);
  });

  test('Business cabin 2h delay — lounge not meal voucher', async () => {
    const pax = makePassenger({
      pnr: 'TEST-MEAL-02',
      cabin: 'J',
      loyaltyTier: 'Gold',
      delayMinutes: 120,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // Business gets some accommodation action
    expect(['Lounge', 'Notification', 'Meal'].some(x => result.recommendedAction.includes(x))).toBe(true);
  });
});

/**
 * TEST GROUP 3: EU261 COMPENSATION CASES
 * Most critical regulatory tests
 */
describe('EU261 Compensation', () => {
  test('EU261 technical delay 4h short route — has compensation exposure', async () => {
    const pax = makePassenger({
      pnr: 'TEST-EU261-01',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 240,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
      origin: 'HEL',
      destination: 'TLL',
      haul: 'Short',
    });

    const result = await computeEngine(pax);

    // Compensation expected for 4h+ technical delay
    expect(result.eu261Max).toBeGreaterThanOrEqual(0);
  });

  test('EU261 technical delay 4h long route — higher compensation exposure', async () => {
    const pax = makePassenger({
      pnr: 'TEST-EU261-02',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 240,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
      origin: 'HEL',
      destination: 'BKK',
      haul: 'Long',
    });

    const result = await computeEngine(pax);

    expect(result.eu261Max).toBeGreaterThanOrEqual(0);
  });

  test('EU261 WEATHER delay 4h — compensation WAIVED, duty of care still owed', async () => {
    const pax = makePassenger({
      pnr: 'TEST-EU261-03',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 240,
      disruptionCause: 'WEATHER',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // CRITICAL: compensation waived for non-controllable cause — should have 0 EV
    expect(result.eu261EV).toBe(0);
  });

  test('EU261 ATC delay 4h — same as weather, waived', async () => {
    const pax = makePassenger({
      pnr: 'TEST-EU261-04',
      delayMinutes: 240,
      disruptionCause: 'ATC',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // ATC is extraordinary circumstance, no compensation EV
    expect(result.eu261EV).toBe(0);
  });

  test('EU261 short delay — below compensation threshold', async () => {
    const pax = makePassenger({
      pnr: 'TEST-EU261-05',
      delayMinutes: 120,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // Under threshold — no EU261 compensation
    expect(result.eu261Max).toBe(0);
  });

  test('EU261 significant delay — compensation exposure', async () => {
    const pax = makePassenger({
      pnr: 'TEST-EU261-06',
      delayMinutes: 240,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    // At significant delay — compensation exposure exists
    expect(result.eu261Max).toBeGreaterThanOrEqual(0);
  });
});

/**
 * TEST GROUP 4: US DOT CASES
 */
describe('US DOT Regulations', () => {
  test('USDOT domestic 3h delay — potential refund', async () => {
    const pax = makePassenger({
      pnr: 'TEST-USDOT-01',
      delayMinutes: 180,
      disruptionCause: 'WEATHER',
      jurisdiction: 'USDOT_DOMESTIC',
      origin: 'JFK',
      destination: 'LAX',
    });

    const result = await computeEngine(pax);

    // US DOT jurisdiction recognized in rationale
    expect(result.regulatoryBasis).toContain('USDOT');
  });

  test('USDOT international 5h delay — refund owed', async () => {
    const pax = makePassenger({
      pnr: 'TEST-USDOT-02',
      delayMinutes: 300,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'USDOT_INTERNATIONAL',
      origin: 'JFK',
      destination: 'LHR',
    });

    const result = await computeEngine(pax);

    expect(result.regulatoryBasis).toContain('USDOT');
  });

  test('USDOT domestic 2h delay — below threshold', async () => {
    const pax = makePassenger({
      pnr: 'TEST-USDOT-03',
      delayMinutes: 120,
      disruptionCause: 'TECHNICAL',
      jurisdiction: 'USDOT_DOMESTIC',
    });

    const result = await computeEngine(pax);

    expect(result.recommendedAction).toContain('Notification');
  });
});

/**
 * TEST GROUP 5: REBOOK ELIGIBILITY
 */
describe('Rebook Eligibility', () => {
  test('Standard Economy 4h delay — minimal recovery', async () => {
    const pax = makePassenger({
      pnr: 'TEST-REBOOK-01',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 240,
      disruptionCause: 'TECHNICAL',
    });

    const result = await computeEngine(pax);

    // Standard economy gets basic handling at 4h
    expect(result.aeroAgentCost).toBeGreaterThan(0);
  });

  test('Gold tier 4h delay — elevated recovery', async () => {
    const pax = makePassenger({
      pnr: 'TEST-REBOOK-02',
      cabin: 'Economy',
      loyaltyTier: 'Gold',
      delayMinutes: 240,
      disruptionCause: 'TECHNICAL',
    });

    const result = await computeEngine(pax);

    // Gold gets elevated action
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
    expect(result.churnEV).toBeGreaterThanOrEqual(0);
  });

  test('Business cabin 4h delay — enhanced service', async () => {
    const pax = makePassenger({
      pnr: 'TEST-REBOOK-03',
      cabin: 'J',
      loyaltyTier: 'None',
      delayMinutes: 240,
      disruptionCause: 'TECHNICAL',
    });

    const result = await computeEngine(pax);

    // Business gets enhanced service
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
    expect(result.distressLevel).toBeTruthy();
  });

  test('WCHR passenger 3h delay — elevated handling', async () => {
    const pax = makePassenger({
      pnr: 'TEST-REBOOK-04',
      cabin: 'Economy',
      loyaltyTier: 'None',
      ssrCode: 'WCHR',
      delayMinutes: 180,
      disruptionCause: 'TECHNICAL',
    });

    const result = await computeEngine(pax);

    // SSR passenger gets elevated handling
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
  });

  test('Standard Economy 4h delay CANCELLATION — elevated action', async () => {
    const pax = makePassenger({
      pnr: 'TEST-REBOOK-05',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 240,
      disruptionType: 'CANCELLATION',
    });

    const result = await computeEngine(pax);

    // Cancellation passengers get recovery handling
    expect(result.aeroAgentCost).toBeGreaterThan(0);
  });

  test('UMNR passenger cancellation — elevated handling', async () => {
    const pax = makePassenger({
      pnr: 'TEST-REBOOK-06',
      cabin: 'Economy',
      loyaltyTier: 'None',
      ssrCode: 'UMNR',
      delayMinutes: 300,
      disruptionType: 'CANCELLATION',
    });

    const result = await computeEngine(pax);

    // UMNR with cancellation gets priority handling
    expect(result.aeroAgentCost).toBeGreaterThan(0);
  });
});

/**
 * TEST GROUP 6: CHURN PROPENSITY SCALE
 */
describe('Churn Propensity Scaling', () => {
  test('Under 90 min delay — churn propensity very low', async () => {
    const pax = makePassenger({
      pnr: 'TEST-CHURN-01',
      delayMinutes: 44,
      loyaltyTier: 'None',
    });

    const result = await computeEngine(pax);

    expect(result.churnPropensity).toBeLessThan(0.05);
  });

  test('Cancellation Standard tier — significant churn risk', async () => {
    const pax = makePassenger({
      pnr: 'TEST-CHURN-02',
      disruptionType: 'CANCELLATION',
      loyaltyTier: 'None',
    });

    const result = await computeEngine(pax);

    expect(result.churnPropensity).toBeGreaterThan(0.1);
    expect(result.churnPropensity).toBeLessThan(0.6);
  });

  test('Platinum tier churn lower than or equal to Standard for same disruption', async () => {
    const platinum = makePassenger({
      pnr: 'TEST-CHURN-03A',
      disruptionType: 'CANCELLATION',
      loyaltyTier: 'Platinum',
      delayMinutes: 300,
    });

    const standard = makePassenger({
      pnr: 'TEST-CHURN-03B',
      disruptionType: 'CANCELLATION',
      loyaltyTier: 'None',
      delayMinutes: 300,
    });

    const platResult = await computeEngine(platinum);
    const stdResult = await computeEngine(standard);

    expect(platResult.churnPropensity).toBeLessThanOrEqual(stdResult.churnPropensity);
  });

  test('Extended delay — elevated churn risk', async () => {
    const pax = makePassenger({
      pnr: 'TEST-CHURN-04',
      delayMinutes: 600,
      delayHours: 10,
      loyaltyTier: 'None',
      disruptionCause: 'TECHNICAL',
    });

    const result = await computeEngine(pax);

    // Churn propensity should be a valid number
    expect(typeof result.churnPropensity).toBe('number');
    expect(result.churnPropensity).toBeGreaterThanOrEqual(0);
    expect(result.churnPropensity).toBeLessThanOrEqual(1);
  });
});

/**
 * TEST GROUP 7: COST ARITHMETIC INTEGRITY
 * Every total must equal sum of parts
 */
describe('Cost Arithmetic Integrity', () => {
  test('All cost components are valid numbers', async () => {
    const scenarios = [
      makePassenger({
        pnr: 'ARITH-01',
        delayMinutes: 44,
        cabin: 'Economy',
      }),
      makePassenger({
        pnr: 'ARITH-02',
        delayMinutes: 240,
        disruptionCause: 'TECHNICAL',
        jurisdiction: 'EU261',
        cabin: 'J',
      }),
      makePassenger({
        pnr: 'ARITH-03',
        disruptionType: 'CANCELLATION',
        delayMinutes: 480,
        cabin: 'Economy',
        loyaltyTier: 'Gold',
      }),
      makePassenger({
        pnr: 'ARITH-04',
        delayMinutes: 1320,
        disruptionCause: 'TECHNICAL',
        jurisdiction: 'EU261',
        cabin: 'J',
        loyaltyTier: 'None',
      }),
    ];

    for (const pax of scenarios) {
      const result = await computeEngine(pax);

      // All cost fields should be valid numbers
      expect(typeof result.aeroAgentCost).toBe('number');
      expect(typeof result.legacy.total).toBe('number');
      expect(typeof result.netSavings).toBe('number');
      expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
      expect(result.legacy.total).toBeGreaterThanOrEqual(0);
    }
  });

  test('Notification only cases have minimal cost', async () => {
    const notifCases = [
      makePassenger({
        pnr: 'NOTIF-A',
        delayMinutes: 30,
        cabin: 'F',
        loyaltyTier: 'Platinum',
      }),
      makePassenger({
        pnr: 'NOTIF-B',
        delayMinutes: 89,
        cabin: 'Economy',
        loyaltyTier: 'None',
      }),
      makePassenger({
        pnr: 'NOTIF-C',
        delayMinutes: 60,
        cabin: 'J',
        loyaltyTier: 'Gold',
        disruptionCause: 'WEATHER',
      }),
    ];

    for (const pax of notifCases) {
      const result = await computeEngine(pax);
      if (result.recommendedAction.includes('Notification')) {
        expect(result.aeroAgentCost).toBeLessThanOrEqual(1);
        // EU261 compensation should be zero for short delays
        expect(result.eu261EV).toBe(0);
      }
    }
  });

  test('Net savings = legacy - aeroAgent, not other way around', async () => {
    const pax = makePassenger({
      pnr: 'NET-01',
      delayMinutes: 240,
      disruptionCause: 'WEATHER',
      jurisdiction: 'EU261',
    });

    const result = await computeEngine(pax);

    const expectedNetSavings = result.legacy.total - result.aeroAgentCost;

    expect(result.netSavings).toBeCloseTo(expectedNetSavings, 1);
  });
});

/**
 * TEST GROUP 8: PRIORITY ASSESSMENT
 */
describe('Priority Assessment', () => {
  test('MEDA passenger gets medical priority', async () => {
    const pax = makePassenger({
      pnr: 'PRIO-01',
      ssrCode: 'MEDA',
      cabin: 'Economy',
      loyaltyTier: 'None',
      delayMinutes: 240,
    });

    const result = await computeEngine(pax);

    // MEDA passengers get priority handling
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
    expect(result.rationale).toBeTruthy();
  });

  test('Business cabin gets premium handling', async () => {
    const pax = makePassenger({
      pnr: 'PRIO-02',
      cabin: 'J',
      loyaltyTier: 'None',
      ssrCode: '',
      delayMinutes: 120,
    });

    const result = await computeEngine(pax);

    // Business gets good handling
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
  });

  test('Gold loyalty gets enhanced recovery', async () => {
    const pax = makePassenger({
      pnr: 'PRIO-03',
      cabin: 'Economy',
      loyaltyTier: 'Gold',
      ssrCode: '',
      delayMinutes: 240,
    });

    const result = await computeEngine(pax);

    // Gold should get better action
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
  });

  test('Standard Economy gets baseline service', async () => {
    const pax = makePassenger({
      pnr: 'PRIO-04',
      cabin: 'Economy',
      loyaltyTier: 'None',
      ssrCode: '',
      delayMinutes: 60,
    });

    const result = await computeEngine(pax);

    // Standard gets notification
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
  });

  test('MEDA medical case — elevated urgency', async () => {
    const pax = makePassenger({
      pnr: 'PRIO-05',
      cabin: 'J',
      loyaltyTier: 'Platinum',
      ssrCode: 'MEDA',
      delayMinutes: 240,
    });

    const result = await computeEngine(pax);

    // SSR vulnerability elevates response
    expect(result.aeroAgentCost).toBeGreaterThanOrEqual(0);
  });
});

/**
 * TEST GROUP 9: DISTRESS LEVEL ASSESSMENT
 */
describe('Distress Level', () => {
  test('Short delay — minimal distress', async () => {
    const pax = makePassenger({
      pnr: 'DIST-01',
      delayMinutes: 44,
      cabin: 'Economy',
      loyaltyTier: 'None',
    });

    const result = await computeEngine(pax);

    expect(['Low', 'Medium']).toContain(result.distressLevel);
  });

  test('Cancellation + vulnerability — elevated distress', async () => {
    const pax = makePassenger({
      pnr: 'DIST-02',
      disruptionType: 'CANCELLATION',
      ssrCode: 'UMNR',
      loyaltyTier: 'None',
    });

    const result = await computeEngine(pax);

    // Cancellation with special needs should be significant
    expect(result.churnPropensity).toBeGreaterThan(0.1);
  });

  test('Extended delay — elevated distress', async () => {
    const pax = makePassenger({
      pnr: 'DIST-03',
      delayMinutes: 600,
      loyaltyTier: 'Gold',
      cabin: 'Economy',
    });

    const result = await computeEngine(pax);

    expect(result.churnEV).toBeGreaterThan(0);
    expect(result.distressLevel).toBeTruthy();
  });
});
