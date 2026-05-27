import { generateSeedData } from './src/seed.ts';

const passengers = generateSeedData();

// Find the same passenger
const pax = passengers.find(p => 
  (p.cabin === 'Business' || p.cabin === 'F' || p.cabin === 'J') && 
  p.delayHours >= 1.5 && 
  p.delayHours < 3
);

if (pax) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  LAYER 4 DEBUG TRACE                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Passenger: ${pax.pnr}`);
  console.log(`  cabin: ${pax.cabin}`);
  console.log(`  tier: ${pax.tier}`);
  console.log(`  delayHours: ${pax.delayHours}`);
  console.log(`  disruptionType: ${pax.disruptionType}`);
  console.log('');
  
  // Manually trace Layer 4 logic
  const delayHours = pax.delayHours;
  const premiumTiers = ['Platinum', 'Platinum Lumo', 'oneworld Emerald', 'Gold'];
  const isPremiumTier = premiumTiers.includes(pax.tier);
  const isPremiumCabin = pax.cabin === 'Business';
  
  console.log('LAYER 4 Variable Initialization:');
  console.log(`  delayHours: ${delayHours}`);
  console.log(`  isPremiumCabin: ${isPremiumCabin}`);
  console.log(`  isPremiumTier: ${isPremiumTier}`);
  console.log('');
  
  // Rebook eligibility section
  console.log('Rebook Eligibility Check:');
  let rebookEligible = false;
  let mealsRequired = false;
  let loungeRequired = false;
  
  console.log(`  delayHours >= 3 && disruptionType === CANCELLATION? ${delayHours >= 3 && pax.disruptionType === 'CANCELLATION'}`);
  if (delayHours >= 3 && pax.disruptionType === 'CANCELLATION') {
    rebookEligible = true;
    console.log('  → Branch 1: rebookEligible = true');
  } else if (delayHours >= 5) {
    rebookEligible = true;
    console.log('  → Branch 2: rebookEligible = true (5+ hours)');
  } else if (delayHours >= 1.5 && delayHours < 5) {
    console.log(`  → Branch 3: delayHours >= 1.5 && < 5 is TRUE`);
    console.log(`     isPremiumCabin || isPremiumTier? ${isPremiumCabin || isPremiumTier}`);
    if (isPremiumCabin || isPremiumTier) {
      loungeRequired = true;
      console.log('     → loungeRequired = true');
    } else {
      mealsRequired = true;
      console.log('     → mealsRequired = true');
    }
  } else {
    console.log(`  → No branch matched`);
  }
  
  console.log('');
  console.log('Primary Action Determination:');
  let primaryAction = 'NOTIFICATION_ONLY';
  const isSpecialNeeds = false; // assuming no SSR code
  
  console.log(`  isSpecialNeeds? ${isSpecialNeeds}`);
  console.log(`  rebookEligible? ${rebookEligible}`);
  console.log(`  loungeRequired? ${loungeRequired}`);
  console.log(`  mealsRequired? ${mealsRequired}`);
  
  if (isSpecialNeeds) {
    primaryAction = 'special needs handling';
    console.log('  → Matched: isSpecialNeeds');
  } else if (rebookEligible) {
    primaryAction = 'rebook handling';
    console.log('  → Matched: rebookEligible');
  } else if (loungeRequired) {
    primaryAction = 'LOUNGE_ACCESS';
    console.log('  → Matched: loungeRequired → primaryAction = LOUNGE_ACCESS ✓');
  } else if (mealsRequired) {
    primaryAction = 'MEAL_VOUCHER';
    console.log('  → Matched: mealsRequired');
  } else {
    primaryAction = 'NOTIFICATION_ONLY';
    console.log('  → Default: NOTIFICATION_ONLY');
  }
  
  console.log('');
  console.log('Final Result:');
  console.log(`  primaryAction: ${primaryAction}`);
  console.log(`  Expected: LOUNGE_ACCESS`);
  console.log(`  Match: ${primaryAction === 'LOUNGE_ACCESS' ? '✓ YES' : '✗ NO'}`);
  
  console.log('\n════════════════════════════════════════════════════════════════\n');
}
