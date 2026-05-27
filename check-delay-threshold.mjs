import { generateSeedData } from './src/seed.ts';
import { computeEngineLocal } from './src/engine.ts';

const passengers = generateSeedData();

// Find Business cabin passenger with delayMinutes 90-179
const target = passengers.find(p => 
  (p.cabin === 'Business' || p.cabin === 'F' || p.cabin === 'J') && 
  p.delayHours >= 1.5 && 
  p.delayHours < 3
);

if (target) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         DELAY THRESHOLD VERIFICATION (90-180 minute band)       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('Passenger Found:');
  console.log(`  PNR: ${target.pnr}`);
  console.log(`  Cabin: ${target.cabin}`);
  console.log(`  delayHours: ${target.delayHours}`);
  console.log(`  delayMinutes: ${Math.round(target.delayHours * 60)}`);
  console.log(`  Tier: ${target.tier}`);
  console.log('');
  
  // Run engine and capture result
  const analysis = computeEngineLocal(target);
  
  console.log('Engine Output:');
  console.log(`  recommendedAction: ${analysis.recommendedAction}`);
  console.log(`  suggestedStatus: ${analysis.suggestedStatus}`);
  console.log('');
  
  // Manually trace through Layer 3 logic
  const delayHours = target.delayHours;
  const isPremiumCabin = target.cabin === 'Business';
  const isPremiumTier = ['Platinum', 'Platinum Lumo', 'oneworld Emerald', 'Gold'].includes(target.tier);
  
  console.log('Layer 3 Logic Trace:');
  console.log(`  delayHours: ${delayHours}`);
  console.log(`  delayHours >= 1.5? ${delayHours >= 1.5}`);
  console.log(`  delayHours < 3? ${delayHours < 3}`);
  console.log(`  isPremiumCabin (cabin === Business): ${isPremiumCabin}`);
  console.log(`  isPremiumTier: ${isPremiumTier}`);
  console.log('');
  
  if (delayHours >= 1.5 && delayHours < 3) {
    console.log('  ✓ Falls in 90-180 minute band (1.5h - 3h)');
    if (isPremiumCabin || isPremiumTier) {
      console.log('  ✓ Premium cabin or tier detected');
      console.log('  → Expected: loungeAccessOffered = true');
      console.log('  → Expected: whatsappMessageType = LOUNGE_ACCESS');
      console.log('  → Expected primaryAction from Layer 4: LOUNGE_ACCESS');
    }
  }
  
  console.log('\nActual Values from Analysis:');
  console.log(`  recommendedAction includes "Lounge": ${analysis.recommendedAction.includes('Lounge')}`);
  
  console.log('\n════════════════════════════════════════════════════════════════\n');
} else {
  console.log('❌ No Business cabin passenger found with 90-179 minute delay');
  console.log('Searching for any Business cabin passenger...');
  const business = passengers.find(p => p.cabin === 'Business');
  if (business) {
    console.log(`Found: ${business.pnr}, delay: ${business.delayHours.toFixed(1)}h (${Math.round(business.delayHours * 60)}min)`);
  }
}
