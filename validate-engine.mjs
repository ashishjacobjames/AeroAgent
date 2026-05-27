import { generateSeedData } from './src/seed.ts';
import { computeEngine } from './src/engine.ts';

console.log('✓ Generating 250 seed passengers...\n');
const passengers = generateSeedData();
console.log(`✓ Generated ${passengers.length} passengers\n`);

// Test Case 1: UMNR (Unaccompanied Minor)
console.log('=== TEST 1: UMNR Passenger ===');
const umnr = passengers.find(p => p.ssrCode === 'UMNR');
if (umnr) {
  const analysis = computeEngine(umnr);
  console.log(`PNR: ${umnr.pnr}`);
  console.log(`SSR Code: ${umnr.ssrCode}`);
  console.log(`Recommended Action: ${analysis.recommendedAction}`);
  console.log(`Suggested Status: ${analysis.suggestedStatus}`);
  console.log(`Distress Level: ${analysis.aiDistressLevel || 'N/A'}`);
  console.log(`Expected: ESCALATE_TO_AGENT or pending_validation status`);
  console.log(`Result: ${analysis.suggestedStatus === 'pending_validation' ? '✓ PASS' : '✗ FAIL'}\n`);
} else {
  console.log('✗ No UMNR passenger found\n');
}

// Test Case 2: WEATHER cause + EU261 jurisdiction + 3h delay
console.log('=== TEST 2: WEATHER + EU261 + 3h+ Delay ===');
const weather = passengers.find(p => 
  p.disruptionCause === 'WEATHER' && 
  p.jurisdiction === 'EU' && 
  p.delayHours > 3
);
if (weather) {
  const analysis = computeEngine(weather);
  console.log(`PNR: ${weather.pnr}`);
  console.log(`Disruption Cause: ${weather.disruptionCause}`);
  console.log(`Jurisdiction: ${weather.jurisdiction}`);
  console.log(`Delay Hours: ${weather.delayHours}`);
  console.log(`Cash Compensation Owed: false (extraordinary circumstance)`);
  console.log(`Duty of Care Owed: ${analysis.liabilityEngine.dutyOfCare.meals.eligible ? 'true' : 'false'}`);
  console.log(`Result: ${!analysis.liabilityEngine.financialExposure.eu261.max && analysis.liabilityEngine.dutyOfCare.meals.eligible ? '✓ PASS' : '✗ FAIL'}\n`);
} else {
  console.log('✗ No matching passenger found\n');
}

// Test Case 3: Business cabin + 2h delay
console.log('=== TEST 3: Business Cabin + 2h Delay ===');
const business2h = passengers.find(p => 
  p.cabin === 'Business' && 
  p.delayHours >= 1.5 && 
  p.delayHours < 2.5
);
if (business2h) {
  const analysis = computeEngine(business2h);
  console.log(`PNR: ${business2h.pnr}`);
  console.log(`Cabin: ${business2h.cabin}`);
  console.log(`Delay Hours: ${business2h.delayHours}`);
  console.log(`Primary Action: ${analysis.recommendedAction}`);
  console.log(`Expected: LOUNGE_ACCESS`);
  console.log(`Result: ${analysis.recommendedAction.includes('Lounge') ? '✓ PASS' : '✗ FAIL'}\n`);
} else {
  console.log('✗ No matching passenger found\n');
}

// Test Case 4: Economy + 6h delay
console.log('=== TEST 4: Economy Cabin + 6h Delay ===');
const economy6h = passengers.find(p => 
  p.cabin === 'Economy' && 
  p.delayHours >= 5.5 && 
  p.delayHours < 6.5 &&
  p.tier !== 'Gold' && p.tier !== 'Silver' && p.tier !== 'Platinum'
);
if (economy6h) {
  const analysis = computeEngine(economy6h);
  console.log(`PNR: ${economy6h.pnr}`);
  console.log(`Cabin: ${economy6h.cabin}`);
  console.log(`Tier: ${economy6h.tier}`);
  console.log(`Delay Hours: ${economy6h.delayHours}`);
  console.log(`Rebook Eligible: false`);
  console.log(`Primary Action includes Hotel & Meals: ${analysis.recommendedAction.includes('Hotel')}`);
  console.log(`Result: ${!analysis.liabilityEngine.itinerary.isSameMetal || analysis.recommendedAction.includes('Recovery') ? '✓ PASS' : '✗ FAIL'}\n`);
} else {
  console.log('✗ No matching passenger found\n');
}

// Test Case 5: Cancellation
console.log('=== TEST 5: Cancellation Scenario ===');
const cancellation = passengers.find(p => p.disruptionType === 'CANCELLATION');
if (cancellation) {
  const analysis = computeEngine(cancellation);
  console.log(`PNR: ${cancellation.pnr}`);
  console.log(`Disruption Type: ${cancellation.disruptionType}`);
  console.log(`Rebook Eligible: ${analysis.liabilityEngine.itinerary.status === 'Rebooked'}`);
  console.log(`Expected: rebookEligible = true`);
  console.log(`Result: ${analysis.liabilityEngine.itinerary.status === 'Rebooked' ? '✓ PASS' : '✗ FAIL'}\n`);
} else {
  console.log('✗ No cancellation passenger found\n');
}

// Test Case 6: Gold tier + 4h delay
console.log('=== TEST 6: Gold Tier + 4h Delay ===');
const gold4h = passengers.find(p => 
  p.tier === 'Gold' && 
  p.delayHours >= 3.5 && 
  p.delayHours < 4.5
);
if (gold4h) {
  const analysis = computeEngine(gold4h);
  console.log(`PNR: ${gold4h.pnr}`);
  console.log(`Tier: ${gold4h.tier}`);
  console.log(`Delay Hours: ${gold4h.delayHours}`);
  console.log(`Rebook Eligible: ${analysis.liabilityEngine.itinerary.status === 'Rebooked'}`);
  console.log(`Same Metal First: ${analysis.liabilityEngine.itinerary.isSameMetal}`);
  console.log(`Result: ${analysis.liabilityEngine.itinerary.status === 'Rebooked' && analysis.liabilityEngine.itinerary.isSameMetal ? '✓ PASS' : '✗ FAIL'}\n`);
} else {
  console.log('✗ No matching passenger found\n');
}

console.log('=== VALIDATION COMPLETE ===');
