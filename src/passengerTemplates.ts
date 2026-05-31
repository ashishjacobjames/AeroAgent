import { Passenger, AnalysisResult } from './types';
import { MEAL_VOUCHER_RATE } from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PassengerMessage {
  messageBody: string;
  ctaType: 'none' | 'accept-or-help' | 'help-only';
  qrPayload?: string;
  offerSummary?: string;
  templateKey: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getFirstName(fullName: string): string {
  return (fullName || 'there').split(' ')[0];
}

function fmt(isoOrUndef: string | undefined, fallback = 'shortly'): string {
  if (!isoOrUndef) return fallback;
  try {
    return new Date(isoOrUndef).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

function addMinutes(iso: string | undefined, mins: number): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(new Date(iso).getTime() + mins * 60_000).toISOString();
  } catch {
    return undefined;
  }
}

function humanDelay(mins: number): string {
  if (mins < 60) return `${mins} minutes`;
  const h = Math.round(mins / 6) / 10;
  return `${h} hour${h !== 1 ? 's' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

function selectTemplate(
  pax: Passenger,
  result: Partial<AnalysisResult>
): 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' {
  const action = (result.recommendedAction || '').toLowerCase();
  const delayMins = pax.delayMinutes ?? Math.round((pax.delayHours ?? 0) * 60);
  const isCancellation = pax.disruptionType === 'CANCELLATION';
  const hotelRequired =
    result.recoveryDecision?.hotelRequired === true ||
    action.includes('hotel');
  const loungeOffered =
    result.goodwillAction?.loungeAccessOffered === true ||
    result.goodwillAction?.loungeAccess === true ||
    action.includes('lounge');
  const mealOffered =
    result.goodwillAction?.mealVoucherOffered === true ||
    action.includes('meal') ||
    action.includes('voucher');
  const isRebook =
    result.recoveryDecision?.rebookEligible === true ||
    action.includes('same metal') ||
    action.includes('alternative flight') ||
    action.includes('rebook') ||
    action.includes('recovery');
  const isPartner =
    action.includes('partner') ||
    action.includes('interline');
  const isEscalation =
    action.includes('concierge') ||
    action.includes('manual') ||
    action.includes('priority');

  // Cancellation cases
  if (isCancellation) {
    if (isEscalation || !isRebook) return 'T7';
    if (isPartner) return 'T5';
    if (hotelRequired) return 'T6';
    return 'T4';
  }

  // Delay cases — priority order
  if (hotelRequired) return 'T6';
  if (isPartner && isRebook) return 'T5';
  if (isRebook && !hotelRequired) return 'T4';
  if (loungeOffered) return 'T2';
  if (mealOffered) return 'T3';
  if (delayMins >= 120) return 'T3'; // long delay with no specific offer → voucher
  return 'T1';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function getPassengerMessage(
  pax: Passenger,
  result: Partial<AnalysisResult>
): PassengerMessage {
  const firstName = getFirstName(pax.name);
  const delayMins = pax.delayMinutes ?? Math.round((pax.delayHours ?? 0) * 60);
  const newDepIso = addMinutes(pax.scheduledDeparture, delayMins);
  const newDepTime = fmt(newDepIso, 'the updated time shown at the gate');
  const mealValue = result.goodwillAction?.mealVoucherValue || MEAL_VOUCHER_RATE;
  const cabin = pax.cabin ?? 'Economy';
  const key = selectTemplate(pax, result);

  switch (key) {
    // ── T1: Short delay, notification only ──────────────────────────────────
    case 'T1':
      return {
        templateKey: 'T1',
        ctaType: 'none',
        messageBody: [
          `Hi ${firstName} — we're sorry for the delay to your flight ${pax.flightNumber} to ${pax.destination}.`,
          '',
          `We're currently showing a delay of ${humanDelay(delayMins)}. Your updated departure time is **${newDepTime}**.`,
          '',
          'Our team is working hard to get everyone moving as smoothly as possible — thank you for your patience.',
        ].join('\n'),
      };

    // ── T2: Lounge access ───────────────────────────────────────────────────
    case 'T2':
      return {
        templateKey: 'T2',
        ctaType: 'none',
        qrPayload: `LOUNGE-${pax.uid}-${pax.flightNumber}`,
        messageBody: [
          `Hi ${firstName} — we're sorry for the delay and want to make your wait as comfortable as possible.`,
          '',
          `We've arranged complimentary lounge access for you while you wait for flight ${pax.flightNumber}. Please make your way to the **Finnair Lounge, Terminal 2** and show the QR code below at the entrance.`,
          '',
          `Your updated departure is at **${newDepTime}**. Help yourself to refreshments, comfortable seating, and Wi-Fi.`,
        ].join('\n'),
      };

    // ── T3: Meal voucher ────────────────────────────────────────────────────
    case 'T3':
      return {
        templateKey: 'T3',
        ctaType: 'none',
        qrPayload: `VOUCHER-${pax.uid}-${mealValue}-${pax.flightNumber}`,
        messageBody: [
          `Hi ${firstName} — we're sorry about the delay to your flight ${pax.flightNumber}. As a thank you for your patience, we've issued you a **€${mealValue} meal voucher** valid at all restaurants and cafés in the departures terminal.`,
          '',
          `Simply show the QR code below at any participating outlet. Your updated departure is at **${newDepTime}**.`,
        ].join('\n'),
      };

    // ── T4: Rebook same airline ──────────────────────────────────────────────
    case 'T4':
      return {
        templateKey: 'T4',
        ctaType: 'accept-or-help',
        offerSummary: `New flight arranged · Departs ${newDepTime} · ${cabin}`,
        messageBody: [
          `Hi ${firstName} — we're genuinely sorry for the disruption to your journey today.`,
          '',
          `We've secured you a seat on the next available service to **${pax.destination}**, departing at **${newDepTime}** in the same cabin class. Your booking reference **${pax.pnr}** remains valid — no changes needed at check-in.`,
          '',
          'Please confirm you\'re happy with this, or tap "I need help" if you\'d like to discuss alternatives.',
        ].join('\n'),
      };

    // ── T5: Rebook partner airline ───────────────────────────────────────────
    case 'T5':
      return {
        templateKey: 'T5',
        ctaType: 'accept-or-help',
        offerSummary: `Partner flight · Departs ${newDepTime} · ${cabin}`,
        messageBody: [
          `Hi ${firstName} — we're sorry for today's disruption and want to get you to **${pax.destination}** as quickly as possible.`,
          '',
          `We've arranged a seat on a partner carrier departing at **${newDepTime}**. Your baggage will be transferred automatically, and your booking reference **${pax.pnr}** covers this flight — no additional booking needed.`,
          '',
          'Please confirm this arrangement works for you, or tap "I need help" if you have any questions.',
        ].join('\n'),
      };

    // ── T6: Hotel overnight ──────────────────────────────────────────────────
    case 'T6':
      return {
        templateKey: 'T6',
        ctaType: 'accept-or-help',
        offerSummary: `Hotel: Airport Hotel · Transfer at 21:00 · Breakfast included`,
        messageBody: [
          `Hi ${firstName} — we're deeply sorry for what has been a difficult day.`,
          '',
          `Your flight to **${pax.destination}** has been disrupted overnight. We've arranged a complimentary stay at the **Airport Hotel** near the terminal. A shuttle departs from **Door 3 at 21:00** — look for the AeroAgent representative.`,
          '',
          'Breakfast is included and we have you booked on the first available morning departure. Please confirm this works for you, or tap "I need help" if you need anything adjusted.',
        ].join('\n'),
      };

    // ── T7: Cancellation, no rebook ──────────────────────────────────────────
    case 'T7':
    default:
      return {
        templateKey: 'T7',
        ctaType: 'help-only',
        messageBody: [
          `Hi ${firstName} — we need to share some important news about your flight ${pax.flightNumber} to **${pax.destination}**.`,
          '',
          'Unfortunately, this flight has been cancelled. We understand this is a significant disruption to your plans and we\'re truly sorry.',
          '',
          'Our team is actively working on rebooking options right now. Tap below to be connected immediately with a gate agent who can look at all available alternatives with you.',
        ].join('\n'),
      };
  }
}
