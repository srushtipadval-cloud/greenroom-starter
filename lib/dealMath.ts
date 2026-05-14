import type { Deal, Expense, TicketSale, Bonus } from "@/db/schema";

export interface ParsedDealTerms {
  guarantee?: number;
  percentage?: number;
  expenseCap?: number;
  hospitalityCap?: number;
  walkoutPotThreshold?: number;
  tierRatchet?: { basePercentage: number; ratchetPercentage: number; capacityThreshold: number; };
  bonusThreshold?: number;
  bonusAmount?: number;
  marketingRecoup?: number;
  confidence: "high" | "medium" | "low";
  flags: string[];
}

export type SettlementCalculation =
  | {
      supported: true;
      grossBoxOffice: number;
      netBoxOffice: number;
      totalExpenses: number;
      totalToArtist: number;
      steps: { label: string; value: number; note?: string }[];
      finalFormula: string;
      bonusesApplied: { label: string; amount: number; reason: string }[];
      bonusesNotTriggered: { label: string; amount: number; reason: string }[];
      vsResult?: { guaranteeSide: number; percentageSide: number; winner: "guarantee" | "percentage"; };
      dataWarnings?: string[];
    }
  | { supported: false; reason: string; dealType: Deal["dealType"]; };

interface CalcInput {
  deal: Deal;
  ticketSales: TicketSale[];
  expenses: Expense[];
  venueCapacity?: number;
  ticketsSold?: number;
  parsedTerms?: ParsedDealTerms;
}

export function parseBonuses(deal: Deal): Bonus[] {
  if (!deal.bonusesJson) return [];
  try {
    const parsed = JSON.parse(deal.bonusesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

/**
 * Filter legacy bonuses already accounted for by the parser to prevent double-count.
 */
function legacyBonusesAfterParse(deal: Deal, parsedTerms?: ParsedDealTerms): Bonus[] {
  const all = parseBonuses(deal);
  if (!parsedTerms) return all;
  return all.filter((b) => {
    if (b.type !== "gross_threshold") return true;
    if (parsedTerms.walkoutPotThreshold != null &&
        Math.abs(b.threshold - parsedTerms.walkoutPotThreshold) < 1) return false;
    if (parsedTerms.bonusThreshold != null &&
        Math.abs(b.threshold - parsedTerms.bonusThreshold) < 1) return false;
    return true;
  });
}

export function calculateSettlement(input: CalcInput): SettlementCalculation {
  const { deal, ticketSales, expenses, venueCapacity, ticketsSold, parsedTerms } = input;

  const grossBoxOffice = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalFees = ticketSales.reduce((sum, t) => sum + t.fees, 0);
  const netBoxOffice = grossBoxOffice - totalFees;
  const tickets = ticketsSold ?? ticketSales.reduce((sum, t) => sum + (t.qty ?? 0), 0);
  const dataWarnings: string[] = [];

  const expenseCap = parsedTerms?.expenseCap ?? deal.expenseCap ?? null;
  const hospitalityCap = parsedTerms?.hospitalityCap ?? deal.hospitalityCap ?? null;

  const rawExpenses = expenses.filter((e) => !e.absorbedByVenue);
  const hospitalityExpenses = rawExpenses.filter((e) => e.category === "hospitality");
  const otherExpenses = rawExpenses.filter((e) => e.category !== "hospitality");
  const hospitalityTotal = hospitalityExpenses.reduce((s, e) => s + e.amount, 0);
  const otherTotal = otherExpenses.reduce((s, e) => s + e.amount, 0);
  const cappedHospitality = hospitalityCap != null ? Math.min(hospitalityTotal, hospitalityCap) : hospitalityTotal;
  const totalExpensesBeforeCap = cappedHospitality + otherTotal;
  const totalExpenses = expenseCap != null ? Math.min(totalExpensesBeforeCap, expenseCap) : totalExpensesBeforeCap;

  if (hospitalityCap != null && hospitalityTotal > hospitalityCap)
    dataWarnings.push(`Hospitality $${hospitalityTotal.toFixed(0)} exceeds cap $${hospitalityCap.toFixed(0)} — capped at $${cappedHospitality.toFixed(0)}`);
  if (expenseCap != null && totalExpensesBeforeCap > expenseCap)
    dataWarnings.push(`Expenses $${totalExpensesBeforeCap.toFixed(0)} exceed cap $${expenseCap.toFixed(0)} — capped at $${totalExpenses.toFixed(0)}`);
  if (parsedTerms?.flags?.length) dataWarnings.push(...parsedTerms.flags);

  if (deal.dealType === "flat") {
    const guarantee = parsedTerms?.guarantee ?? deal.guaranteeAmount;
    if (guarantee == null) return { supported: false, reason: "Flat deal missing guarantee amount.", dealType: deal.dealType };
    const bonusResult = applyBonuses(legacyBonusesAfterParse(deal, parsedTerms), { gross: grossBoxOffice, tickets, capacity: venueCapacity });
    return {
      supported: true, grossBoxOffice, netBoxOffice, totalExpenses,
      totalToArtist: guarantee + bonusResult.totalApplied,
      steps: [{ label: "Flat guarantee", value: guarantee, note: "No expense deductions." }, ...bonusResult.applied.map((b) => ({ label: b.label, value: b.amount, note: b.reason }))],
      finalFormula: `flat $${guarantee.toFixed(2)} + bonuses $${bonusResult.totalApplied.toFixed(2)} = $${(guarantee + bonusResult.totalApplied).toFixed(2)}`,
      bonusesApplied: bonusResult.applied, bonusesNotTriggered: bonusResult.notTriggered,
      dataWarnings: dataWarnings.length ? dataWarnings : undefined,
    };
  }

  if (deal.dealType === "percentage_of_gross") {
    const pct = parsedTerms?.percentage ?? deal.percentage;
    if (pct == null) return { supported: false, reason: "Missing percentage.", dealType: deal.dealType };
    const payout = grossBoxOffice * pct;
    const bonusResult = applyBonuses(legacyBonusesAfterParse(deal, parsedTerms), { gross: grossBoxOffice, tickets, capacity: venueCapacity });
    return {
      supported: true, grossBoxOffice, netBoxOffice, totalExpenses,
      totalToArtist: payout + bonusResult.totalApplied,
      steps: [{ label: "Gross box office", value: grossBoxOffice }, { label: `x ${(pct * 100).toFixed(0)}%`, value: payout, note: "No expense deductions." }, ...bonusResult.applied.map((b) => ({ label: b.label, value: b.amount, note: b.reason }))],
      finalFormula: `gross $${grossBoxOffice.toFixed(2)} x ${(pct * 100).toFixed(0)}% = $${payout.toFixed(2)}`,
      bonusesApplied: bonusResult.applied, bonusesNotTriggered: bonusResult.notTriggered,
      dataWarnings: dataWarnings.length ? dataWarnings : undefined,
    };
  }

  if (deal.dealType === "percentage_of_net" || deal.dealType === "vs") {
    const guarantee = parsedTerms?.guarantee ?? deal.guaranteeAmount ?? null;
    const pct = parsedTerms?.percentage ?? deal.percentage;
    if (pct == null) return { supported: false, reason: "Missing percentage.", dealType: deal.dealType };
    const netAfterExpenses = netBoxOffice - totalExpenses;

    let effectivePct = pct;
    let ratchetNote: string | undefined;
    if (parsedTerms?.tierRatchet && venueCapacity) {
      const { basePercentage, ratchetPercentage, capacityThreshold } = parsedTerms.tierRatchet;
      const fill = tickets / venueCapacity;
      if (fill >= capacityThreshold) {
        effectivePct = ratchetPercentage;
        ratchetNote = `Ratchet triggered — ${(fill * 100).toFixed(0)}% fill >= ${(capacityThreshold * 100).toFixed(0)}% threshold. % steps up ${(basePercentage * 100).toFixed(0)}% -> ${(ratchetPercentage * 100).toFixed(0)}%`;
      } else {
        ratchetNote = `Ratchet not triggered — ${(fill * 100).toFixed(0)}% fill < ${(capacityThreshold * 100).toFixed(0)}% threshold`;
      }
      if (ratchetNote) dataWarnings.push(ratchetNote);
    }

    const percentageSide = Math.max(0, netAfterExpenses * effectivePct);

    let walkoutPot = 0;
    if (parsedTerms?.walkoutPotThreshold != null) {
      if (grossBoxOffice > parsedTerms.walkoutPotThreshold) {
        walkoutPot = grossBoxOffice - parsedTerms.walkoutPotThreshold;
        dataWarnings.push(`Walkout pot triggered — gross $${grossBoxOffice.toFixed(0)} > threshold $${parsedTerms.walkoutPotThreshold.toFixed(0)}`);
      } else {
        dataWarnings.push(`Walkout pot not triggered — gross $${grossBoxOffice.toFixed(0)} <= threshold $${parsedTerms.walkoutPotThreshold.toFixed(0)}`);
      }
    }

    const bonusResult = applyBonuses(legacyBonusesAfterParse(deal, parsedTerms), { gross: grossBoxOffice, tickets, capacity: venueCapacity });
    if (parsedTerms?.bonusThreshold != null && parsedTerms?.bonusAmount != null) {
      if (grossBoxOffice >= parsedTerms.bonusThreshold) {
        bonusResult.applied.push({ label: `Bonus (gross >= $${parsedTerms.bonusThreshold.toLocaleString()})`, amount: parsedTerms.bonusAmount, reason: `From deal notes` });
        bonusResult.totalApplied += parsedTerms.bonusAmount;
      } else {
        bonusResult.notTriggered.push({ label: `Bonus (gross >= $${parsedTerms.bonusThreshold.toLocaleString()})`, amount: parsedTerms.bonusAmount, reason: `Gross $${grossBoxOffice.toLocaleString()} < threshold` });
      }
    }

    const hasGuarantee = guarantee != null;
    const winner = !hasGuarantee ? "percentage" : percentageSide >= guarantee ? "percentage" : "guarantee";
    const baseAmount = hasGuarantee ? Math.max(guarantee, percentageSide) : percentageSide;
    const totalToArtist = baseAmount + walkoutPot + bonusResult.totalApplied;

    const steps: { label: string; value: number; note?: string }[] = [
      { label: "Gross box office", value: grossBoxOffice },
      { label: "Ticketing fees", value: -(grossBoxOffice - netBoxOffice), note: "Deducted from gross" },
      { label: "Net box office", value: netBoxOffice },
      { label: "Expenses (passed through)", value: -totalExpenses, note: expenseCap != null ? `Capped at $${expenseCap.toFixed(0)}` : undefined },
      { label: "Net after expenses", value: netAfterExpenses },
      { label: `${(effectivePct * 100).toFixed(0)}% of net`, value: percentageSide, note: ratchetNote },
    ];

    if (hasGuarantee) {
      steps.push({ label: winner === "guarantee" ? "Guarantee applies (higher)" : "% of net applies (higher)", value: baseAmount, note: winner === "guarantee" ? `Guarantee $${guarantee!.toLocaleString()} > % side $${percentageSide.toFixed(2)}` : `% side $${percentageSide.toFixed(2)} > guarantee $${guarantee!.toLocaleString()}` });
    }
    if (walkoutPot > 0) steps.push({ label: "Walkout pot", value: walkoutPot });
    bonusResult.applied.forEach((b) => steps.push({ label: b.label, value: b.amount, note: b.reason }));

    const formulaParts = hasGuarantee
      ? [`max(guarantee $${guarantee!.toLocaleString()}, ${(effectivePct * 100).toFixed(0)}% net $${percentageSide.toFixed(2)})`]
      : [`${(effectivePct * 100).toFixed(0)}% of net $${percentageSide.toFixed(2)}`];
    if (walkoutPot > 0) formulaParts.push(`+ walkout $${walkoutPot.toFixed(2)}`);
    if (bonusResult.totalApplied > 0) formulaParts.push(`+ bonuses $${bonusResult.totalApplied.toFixed(2)}`);
    formulaParts.push(`= $${totalToArtist.toFixed(2)}`);

    return {
      supported: true, grossBoxOffice, netBoxOffice, totalExpenses, totalToArtist, steps,
      finalFormula: formulaParts.join(" "),
      bonusesApplied: bonusResult.applied, bonusesNotTriggered: bonusResult.notTriggered,
      vsResult: hasGuarantee ? { guaranteeSide: guarantee!, percentageSide, winner } : undefined,
      dataWarnings: dataWarnings.length ? dataWarnings : undefined,
    };
  }

  if (deal.dealType === "door") {
    const netAfterExpenses = Math.max(0, netBoxOffice - totalExpenses);
    return {
      supported: true, grossBoxOffice, netBoxOffice, totalExpenses, totalToArtist: netAfterExpenses,
      steps: [
        { label: "Gross box office", value: grossBoxOffice },
        { label: "Ticketing fees", value: -(grossBoxOffice - netBoxOffice) },
        { label: "Net box office", value: netBoxOffice },
        { label: "Expenses (passed through)", value: -totalExpenses, note: "Artist takes all net." },
        { label: "Net to artist (door deal)", value: netAfterExpenses },
      ],
      finalFormula: `net $${netBoxOffice.toFixed(2)} - expenses $${totalExpenses.toFixed(2)} = $${netAfterExpenses.toFixed(2)}`,
      bonusesApplied: [], bonusesNotTriggered: [],
      dataWarnings: dataWarnings.length ? dataWarnings : undefined,
    };
  }

  return { supported: false, dealType: deal.dealType, reason: `${deal.dealType} deals not yet supported.` };
}

function applyBonuses(bonuses: Bonus[], ctx: { gross: number; tickets: number; capacity?: number }) {
  const applied: { label: string; amount: number; reason: string }[] = [];
  const notTriggered: { label: string; amount: number; reason: string }[] = [];
  for (const b of bonuses) {
    if (b.type === "gross_threshold") {
      if (ctx.gross >= b.threshold) applied.push({ label: b.label, amount: b.amount, reason: `Gross $${ctx.gross.toLocaleString()} >= $${b.threshold.toLocaleString()}` });
      else notTriggered.push({ label: b.label, amount: b.amount, reason: `Gross $${ctx.gross.toLocaleString()} < $${b.threshold.toLocaleString()}` });
    } else if (b.type === "sellout") {
      if (ctx.capacity != null && ctx.tickets >= ctx.capacity * 0.95) applied.push({ label: b.label, amount: b.amount, reason: `${ctx.tickets} of ${ctx.capacity} sold` });
      else notTriggered.push({ label: b.label, amount: b.amount, reason: ctx.capacity != null ? `${ctx.tickets} of ${ctx.capacity} sold` : "Capacity unknown" });
    } else if (b.type === "attendance_threshold") {
      if (ctx.tickets >= b.threshold) applied.push({ label: b.label, amount: b.amount, reason: `${ctx.tickets} >= ${b.threshold}` });
      else notTriggered.push({ label: b.label, amount: b.amount, reason: `${ctx.tickets} < ${b.threshold}` });
    } else {
      notTriggered.push({ label: b.label, amount: 0, reason: "Tier ratchet handled separately" });
    }
  }
  return { applied, notTriggered, totalApplied: applied.reduce((s, b) => s + b.amount, 0) };
}