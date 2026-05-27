import { generateSeedData } from './src/seed.ts';
import { computeEngineLocal } from './src/engine.ts';

const passengers = generateSeedData();

// Find a Business cabin passenger with 1.5-3h delay
const pax = passengers.find(p => 
  p.cabin === 'Business' && 
  p.delayHours >= 1.5 && 
  p.delayHours < 3
);

if (pax) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('FINAL VERIFICATION - LOUNGE ACCESS THRESHOLD TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('PASSENGER DATA:');
  console.log(`  PNR: ${pax.pnr}`);
  console.log(`  Cabin: ${pax.cabin}`);
  console.log(`  Tier: ${pax.tier}`);
  console.log(`  delayMinutes: ${Math.round(pax.delayHours * 60)}`);
  console.log(`  SSR Code: ${pax.ssrCode || 'None'}`);
  console.log('');
  
  const analysis = computeEngineLocal(pax);
  
  console.log('ENGINE RESULT:');
  console.log(`  recommendedAction: ${analysis.recommendedAction}`);
  console.log(`  liabilityEngine.itinerary.isSameMetal: ${analysis.liabilityEngine.itinerary.isSameMetal}`);
  console.log(`  liabilityEngine.dutyOfCare.lounge.eligible: ${analysis.liabilityEngine.dutyOfCare.lounge?.eligible}`);
  console.log('');
  
  const isCorrect = analysis.recommendedAction.includes('Lounge');
  console.log('EXPECTED vs ACTUAL:');
  console.log(`  Expected: Original Flight Maintained + Lounge Access Issued`);
  console.log(`  Actual: ${analysis.recommendedAction}`);
  console.log(`  Status: ${isCorrect ? '✓ CORRECT' : '✗ INCORRECT ← BUG CONFIRMED'}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}
