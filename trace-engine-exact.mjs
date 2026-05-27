import { generateSeedData } from './src/seed.ts';
import { parseISO, differenceInHours } from 'date-fns';

const passengers = generateSeedData();

// Find the exact passenger that failed
const pax = passengers.find(p => 
  p.cabin === 'Business' && 
  p.delayHours >= 1.5 && 
  p.delayHours < 2.5
);

if (pax) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              EXACT ENGINE CALCULATION TRACE                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Passenger: ${pax.pnr}`);
  console.log(`  pax.delayHours field: ${pax.delayHours}`);
  console.log(`  pax.scheduledArrival: ${pax.scheduledArrival}`);
  console.log(`  pax.estimatedArrival: ${pax.estimatedArrival}`);
  console.log('');
  
  // Recalculate delayHours like the engine does
  const schedArr = parseISO(pax.scheduledArrival);
  const estArr = parseISO(pax.estimatedArrival);
  const engineDelayHours = Math.max(0, differenceInHours(estArr, schedArr));
  
  console.log('Engine delayHours Calculation:');
  console.log(`  parseISO(scheduledArrival): ${schedArr.toISOString()}`);
  console.log(`  parseISO(estimatedArrival): ${estArr.toISOString()}`);
  console.log(`  differenceInHours(estArr, schedArr): ${engineDelayHours}`);
  console.log('');
  
  // Now check the Layer 4 condition
  const delayHours = engineDelayHours;
  const premiumTiers = ['Platinum', 'Platinum Lumo', 'oneworld Emerald', 'Gold'];
  const isPremiumTier = premiumTiers.includes(pax.tier);
  const isPremiumCabin = pax.cabin === 'Business';
  
  console.log('Layer 4 Condition Check:');
  console.log(`  delayHours (${delayHours}) >= 3 && disruptionType === CANCELLATION: ${delayHours >= 3 && pax.disruptionType === 'CANCELLATION'}`);
  console.log(`  delayHours (${delayHours}) >= 5: ${delayHours >= 5}`);
  console.log(`  delayHours (${delayHours}) >= 1.5 && delayHours < 5: ${delayHours >= 1.5 && delayHours < 5}`);
  
  if (delayHours >= 1.5 && delayHours < 5) {
    console.log('  ✓ Branch 3 condition is TRUE');
    console.log(`    isPremiumCabin (${isPremiumCabin}) || isPremiumTier (${isPremiumTier}): ${isPremiumCabin || isPremiumTier}`);
    if (isPremiumCabin || isPremiumTier) {
      console.log('    → loungeRequired should be TRUE ✓');
    }
  } else {
    console.log('  ✗ Branch 3 condition is FALSE - THIS IS THE BUG');
  }
  
  console.log('\n════════════════════════════════════════════════════════════════\n');
}
