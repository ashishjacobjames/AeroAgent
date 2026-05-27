import { generateSeedData } from './src/seed.ts';
import { computeEngineLocal } from './src/engine.ts';

const passengers = generateSeedData();

// Find Business cabin passenger with 1.5-3h delay
const pax = passengers.find(p => 
  p.cabin === 'Business' && 
  p.delayHours >= 1.5 && 
  p.delayHours < 3
);

if (pax) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║            ACTUAL ENGINE OUTPUT vs EXPECTED                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Testing: PNR ${pax.pnr}`);
  console.log(`  Cabin: ${pax.cabin}`);
  console.log(`  Tier: ${pax.tier}`);
  console.log(`  Delay: ${pax.delayHours.toFixed(2)}h = ${Math.round(pax.delayHours * 60)}min`);
  console.log(`  SSR Code: ${pax.ssrCode || 'None'}`);
  console.log('');
  
  const analysis = computeEngineLocal(pax);
  
  console.log('Engine Output:');
  console.log(`  recommendedAction: ${analysis.recommendedAction}`);
  console.log(`  suggestedStatus: ${analysis.suggestedStatus}`);
  console.log(`  liabilityEngine.dutyOfCare.lounge.eligible: ${analysis.liabilityEngine.dutyOfCare.lounge?.eligible}`);
  console.log(`  liabilityEngine.dutyOfCare.lounge.name: ${analysis.liabilityEngine.dutyOfCare.lounge?.name}`);
  console.log('');
  
  const shouldBeLoungeAccess = analysis.recommendedAction.includes('Lounge');
  console.log(`Expected: Original Flight Maintained + Lounge Access Issued`);
  console.log(`Actual: ${analysis.recommendedAction}`);
  console.log(`✓ Correct: ${shouldBeLoungeAccess ? 'YES' : 'NO ❌'}`);
  
  console.log('\n════════════════════════════════════════════════════════════════\n');
}
