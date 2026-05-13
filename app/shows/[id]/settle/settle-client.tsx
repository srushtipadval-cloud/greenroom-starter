"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileWarning, ArrowRight, Check, AlertTriangle,
  Mail, Pencil, XCircle, Wallet, TrendingUp, Sparkles, ShieldAlert, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Field } from "@/components/ui/card";
import { StatusBadge, DealTypeBadge, PlainBadge } from "@/components/ui/badge";
import { calculateSettlement } from "@/lib/dealMath";
import type { ParsedDealTerms } from "@/lib/dealMath";
import { formatMoney, formatShowDateFull } from "@/lib/format";
import type { Settlement, Recoup, Deal, TicketSale, Expense } from "@/db/schema";
import { Logomark } from "@/components/brand/logo";

const RECOUP_LABELS: Record<Recoup["category"], string> = {
  marketing: "Marketing", hospitality_overage: "Hospitality overage",
  production_overage: "Production overage", prior_advance: "Prior advance",
  damages: "Damages", other: "Other",
};

interface SettleClientProps {
  show: { id: string; status: string; date: string };
  artist: { name: string } | null;
  deal: Deal | null;
  ticketSales: TicketSale[];
  expenses: Expense[];
  settlement: Settlement | null;
  recoups: Recoup[];
  venue: { capacity: number } | null;
}

export function SettleClient({ show, artist, deal, ticketSales, expenses, settlement, recoups, venue }: SettleClientProps) {
  const [parsedTerms, setParsedTerms] = useState<ParsedDealTerms | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!deal) {
    return (
      <div className="px-12 py-10 max-w-4xl">
        <BackLink showId={show.id} />
        <div className="text-[13px] text-ink-400">No deal entered for this show.</div>
      </div>
    );
  }

  const calc = calculateSettlement({ deal, ticketSales, expenses, venueCapacity: venue?.capacity ?? undefined, parsedTerms: parsedTerms ?? undefined });
  const grossSoFar = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalFees = ticketSales.reduce((sum, t) => sum + t.fees, 0);
  const totalExpenses = expenses.filter((e) => !e.absorbedByVenue).reduce((sum, e) => sum + e.amount, 0);
  const disputedRecoups = recoups.filter((r) => r.status === "disputed");
  const isDisputed = settlement?.status === "disputed" || settlement?.status === "revised" || !!settlement?.disputedAt;
  const disputedRecoupValue = disputedRecoups.reduce((s, r) => s + r.amount, 0);
  const hasSignoffAnomaly = settlement?.status === "disputed" && !!settlement?.signoffText?.trim();

  async function handleParseDeal() {
    if (!deal?.dealNotesFreetext) return;
    setParsing(true); setParseError(null);
    try {
      const res = await fetch("/api/parse-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealNotesFreetext: deal.dealNotesFreetext, dealType: deal.dealType, structuredFields: { guaranteeAmount: deal.guaranteeAmount, percentage: deal.percentage, expenseCap: deal.expenseCap, hospitalityCap: deal.hospitalityCap, bonusesJson: deal.bonusesJson } }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setParsedTerms(await res.json());
    } catch (err) { setParseError(String(err)); }
    finally { setParsing(false); }
  }

  return (
    <div className={`px-12 py-10 max-w-7xl ${isDisputed ? "bg-gradient-to-b from-rose-50/30 via-canvas to-canvas" : ""}`}>
      <BackLink showId={show.id} />
      <div className="mb-20">
        <div className="flex items-center gap-1.5 mb-4">
          <StatusBadge status={show.status} />
          <DealTypeBadge type={deal.dealType} />
          {settlement?.status === "disputed" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium ring-1 ring-inset bg-rose-50 text-rose-800 ring-rose-200/80">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" /></span>
              Disputed
            </span>
          )}
        </div>
        <h1 className="font-display text-[48px] font-medium text-ink-900 leading-[1.05]" style={{ letterSpacing: "-0.02em" }}>
          Settlement · {artist?.name}
        </h1>
        <div className="text-[14px] text-ink-400 mt-3">{formatShowDateFull(show.date)}</div>
      </div>

      {hasSignoffAnomaly && (
        <div className="mb-6 rounded-lg border border-amber-200/80 bg-amber-50/60 p-5 flex gap-3">
          <ShieldAlert className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-semibold text-amber-800">Status conflict — disputed with positive sign-off</div>
            <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
              This settlement is marked <strong>Disputed</strong> but the artist team already signed off: &ldquo;{settlement?.signoffText}&rdquo;.
              The status has not been updated to reflect the resolution.
            </p>
            <div className="mt-2 text-[11.5px] text-amber-700 font-medium">Action needed: reconcile status to finalized or paid.</div>
          </div>
        </div>
      )}

      {isDisputed && disputedRecoupValue > 0 && (
        <div className="mb-8 rounded-lg border border-rose-200/60 bg-rose-50/40 p-5 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-700 mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-semibold text-rose-800">{disputedRecoups.length} recoup{disputedRecoups.length === 1 ? "" : "s"} in dispute · {formatMoney(disputedRecoupValue)} contested</div>
            <p className="text-[12.5px] text-ink-600 mt-1">The artist team has flagged recoup line items.</p>
          </div>
        </div>
      )}

      {settlement && <LifecycleBar settlement={settlement} disputedRecoups={disputedRecoups.length} />}

      {deal.dealNotesFreetext && (
        <div className="mt-6">
          <Card accent={parsedTerms ? "brand" : undefined}>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-700" />AI deal parser</CardTitle>
                <CardDescription>{parsedTerms ? "Claude extracted these terms from the deal notes. Review before trusting." : "Structured fields are inconsistent. Let Claude read the deal notes and extract real terms."}</CardDescription>
              </div>
              {parsedTerms && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium ring-1 ring-inset ${parsedTerms.confidence === "high" ? "bg-green-50 text-green-800 ring-green-200/80" : parsedTerms.confidence === "medium" ? "bg-amber-50 text-amber-800 ring-amber-200/80" : "bg-rose-50 text-rose-800 ring-rose-200/80"}`}>
                  {parsedTerms.confidence} confidence
                </span>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-[10px] text-ink-500 uppercase tracking-wide mb-2">Deal notes (source)</div>
              <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed mb-4">{deal.dealNotesFreetext}</div>
              {parsedTerms && (
                <div className="mb-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {parsedTerms.guarantee != null && <ParsedField label="Guarantee" value={formatMoney(parsedTerms.guarantee)} />}
                    {parsedTerms.percentage != null && <ParsedField label="Percentage" value={`${(parsedTerms.percentage * 100).toFixed(0)}%`} />}
                    {parsedTerms.expenseCap != null && <ParsedField label="Expense cap" value={formatMoney(parsedTerms.expenseCap)} />}
                    {parsedTerms.hospitalityCap != null && <ParsedField label="Hospitality cap" value={formatMoney(parsedTerms.hospitalityCap)} />}
                    {parsedTerms.walkoutPotThreshold != null && <ParsedField label="Walkout pot above" value={formatMoney(parsedTerms.walkoutPotThreshold)} />}
                    {parsedTerms.bonusThreshold != null && parsedTerms.bonusAmount != null && <ParsedField label={`Bonus if gross >= ${parsedTerms.bonusThreshold.toLocaleString()}`} value={formatMoney(parsedTerms.bonusAmount)} />}
                    {parsedTerms.marketingRecoup != null && <ParsedField label="Marketing recoup" value={formatMoney(parsedTerms.marketingRecoup)} warning />}
                  </div>
                  {parsedTerms.flags.length > 0 && (
                    <div className="rounded-md border border-amber-200/60 bg-amber-50/50 p-3 space-y-1">
                      {parsedTerms.flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-[12px] text-amber-800">{flag}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {parseError && <div className="mb-4 text-[12px] text-rose-700 bg-rose-50 rounded-lg p-3 ring-1 ring-rose-200/60">Parse failed: {parseError}</div>}
              <div className="flex gap-3">
                <button onClick={handleParseDeal} disabled={parsing} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 transition-colors">
                  <Sparkles className="h-3.5 w-3.5" />{parsing ? "Parsing..." : parsedTerms ? "Re-parse" : "Parse with AI"}
                </button>
                {parsedTerms && (
                  <button onClick={() => setParsedTerms(null)} className="inline-flex items-center px-3 py-1.5 rounded-md text-[12.5px] font-medium text-ink-600 ring-1 ring-ink-200/80 hover:ring-ink-300 transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6 mt-6">
        {!calc.supported ? (
          <UnsupportedDeal dealType={calc.dealType} deal={deal} existingSettlement={settlement} grossSoFar={grossSoFar} totalFees={totalFees} totalExpenses={totalExpenses} ticketCount={ticketSales.reduce((s, t) => s + (t.qty ?? 0), 0)} expenseRowCount={expenses.length} hasParsedTerms={!!parsedTerms} onParse={handleParseDeal} parsing={parsing} />
        ) : (
          <SupportedSettlement calc={calc} existingSettlement={settlement} />
        )}
        {recoups.length > 0 && <RecoupsSection recoups={recoups} />}
        {settlement && (settlement.signoffText || settlement.notes) && <SignoffSection settlement={settlement} />}
      </div>

      <div className="mt-16 pt-10 border-t border-ink-200/60">
        <div className="flex gap-4 items-start max-w-3xl">
          <Logomark size={40} className="shrink-0" />
          <div>
            <h2 className="font-display text-[20px] font-medium text-ink-900 mb-2" style={{ letterSpacing: "-0.02em" }}>You&apos;re looking at the seam this case study is about.</h2>
            <p className="text-[13px] text-ink-500 leading-relaxed">
              Greenroom&apos;s in-app settlement tool was built early in the company&apos;s history. About 18% of customers actively use it; the other 82% default to spreadsheets.{" "}
              <Link href="/context" className="text-brand-700 font-medium hover:underline inline-flex items-center gap-0.5">Where to start <ArrowRight className="h-3 w-3" /></Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParsedField({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className={`rounded-md p-3 ring-1 ${warning ? "bg-amber-50/60 ring-amber-200/60" : "bg-canvas-soft ring-ink-200/60"}`}>
      <div className="text-[10px] text-ink-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-[13px] font-mono tabular font-medium ${warning ? "text-amber-800" : "text-ink-900"}`}>{value}</div>
    </div>
  );
}

function BackLink({ showId }: { showId: string }) {
  return (
    <Link href={`/shows/${showId}`} className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to show
    </Link>
  );
}

type Stage = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; timestamp?: Date | null };

function LifecycleBar({ settlement, disputedRecoups }: { settlement: Settlement; disputedRecoups: number }) {
  if (settlement.status === "voided") {
    return (
      <div className="rounded-lg border border-ink-200/80 bg-white px-5 py-4 flex items-center gap-3">
        <XCircle className="h-4 w-4 text-ink-400" />
        <div><div className="text-[13px] font-medium text-ink-900">Settlement voided</div></div>
      </div>
    );
  }
  const stages: Stage[] = [
    { key: "draft", label: "Drafted", icon: Pencil, timestamp: settlement.draftedAt },
    { key: "submitted", label: "Submitted", icon: Mail, timestamp: settlement.submittedAt },
    { key: "review", label: "Reviewed", icon: TrendingUp, timestamp: settlement.reviewStartedAt },
    { key: "signed", label: settlement.disputedAt ? "Finalized" : "Signed", icon: Check, timestamp: settlement.finalizedAt ?? settlement.signedAt },
    { key: "paid", label: "Paid", icon: Wallet, timestamp: settlement.paidAt },
  ];
  const currentIndex = (()=>{ switch(settlement.status){ case "draft": return 0; case "submitted": return 1; case "in_review": return 2; case "disputed": case "signed": case "revised": case "finalized": return 3; case "paid": return 4; default: return 0; } })();
  const isDisputed = settlement.status==="disputed"||settlement.status==="revised"||!!settlement.disputedAt;
  return (
    <Card><CardContent className="py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="eyebrow text-[10px] text-ink-400">Settlement lifecycle</div>
        {isDisputed && <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700"><AlertTriangle className="h-3 w-3" />{settlement.status==="disputed"?"In dispute":settlement.status==="revised"?"Revision sent":"Resolved after dispute"}{disputedRecoups>0&&<span className="text-rose-600"> · {disputedRecoups} disputed recoup{disputedRecoups===1?"":"s"}</span>}</div>}
      </div>
      <div className="grid grid-cols-5 gap-1 relative">
        <div className="absolute top-3.5 left-[10%] right-[10%] h-px bg-ink-200/60" />
        {stages.map((stage,i)=>{
          const isComplete=i<currentIndex,isCurrent=i===currentIndex,isFuture=i>currentIndex,Icon=stage.icon;
          const dot=isComplete?"bg-brand-700 ring-brand-700 text-white":isCurrent?(isDisputed?"bg-rose-50 ring-rose-500 text-rose-700":"bg-brand-50 ring-brand-700 text-brand-700"):"bg-white ring-ink-200/80 text-ink-300";
          return (
            <div key={stage.key} className="flex flex-col items-center text-center">
              <div className={`relative z-10 w-7 h-7 rounded-full ring-2 flex items-center justify-center ${dot}`}><Icon className="h-3.5 w-3.5" /></div>
              <div className={`mt-2.5 text-[11px] font-medium leading-tight ${isFuture?"text-ink-300":"text-ink-900"}`}>{stage.label}</div>
              <div className="text-[10px] text-ink-400 mt-0.5 font-mono tabular leading-tight min-h-[12px]">{stage.timestamp?new Date(stage.timestamp).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}</div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

function UnsupportedDeal({ dealType, deal, existingSettlement, grossSoFar, totalFees, totalExpenses, ticketCount, expenseRowCount, hasParsedTerms, onParse, parsing }: { dealType: string; deal: Deal; existingSettlement: Settlement | null; grossSoFar: number; totalFees: number; totalExpenses: number; ticketCount: number; expenseRowCount: number; hasParsedTerms: boolean; onParse: () => void; parsing: boolean }) {
  const friendly: Record<string,string> = { flat:"flat guarantee", percentage_of_gross:"percentage of gross", percentage_of_net:"percentage of net", vs:"vs deal", door:"door deal" };
  return (
    <>
      <Card accent="amber">
        <CardContent className="py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200/80 mb-5"><FileWarning className="h-5 w-5 text-amber-700" /></div>
          <h2 className="font-display text-[22px] font-medium text-ink-900 mb-2" style={{ letterSpacing: "-0.02em" }}>Structured fields can&apos;t settle a {friendly[dealType]??dealType} yet.</h2>
          <p className="text-[13px] text-ink-500 max-w-md mx-auto leading-relaxed mb-6">The deal notes have everything Claude needs. Use the AI parser above to extract real terms and run the math in-app.</p>
          {!hasParsedTerms && deal.dealNotesFreetext && (
            <button onClick={onParse} disabled={parsing} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 transition-colors">
              <Sparkles className="h-4 w-4" />{parsing?"Parsing deal notes...":"Parse with AI to unlock settlement"}
            </button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>What the system has</CardTitle><CardDescription>The inputs Mariana would pull together to settle this show.</CardDescription></div></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Gross box office" mono value={formatMoney(grossSoFar)} />
            <Field label="Fees" mono value={formatMoney(totalFees)} />
            <Field label="Net box office" mono value={formatMoney(grossSoFar-totalFees)} />
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Tickets sold" mono value={String(ticketCount)} />
            <Field label="Expenses (line items)" mono value={String(expenseRowCount)} />
            <Field label="Expenses (passed through)" mono value={formatMoney(totalExpenses)} />
          </div>
        </CardContent>
      </Card>
      {existingSettlement?.totalToArtist!=null&&(
        <Card accent={existingSettlement.status==="disputed"?"rose":"brand"}>
          <CardHeader>
            <div><CardTitle>Actually settled (off-platform)</CardTitle><CardDescription>Mariana ran this in a spreadsheet.</CardDescription></div>
            {existingSettlement.status==="disputed"?<PlainBadge variant="rose">Disputed</PlainBadge>:<PlainBadge variant="brand">Signed</PlainBadge>}
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between py-2">
              <span className="text-[13px] text-ink-600">Total to artist</span>
              <span className="text-[32px] font-mono tabular font-semibold text-ink-900" style={{ letterSpacing:"-0.02em" }}>{formatMoney(existingSettlement.totalToArtist)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SupportedSettlement({ calc, existingSettlement }: { calc: Extract<ReturnType<typeof calculateSettlement>,{supported:true}>; existingSettlement: Settlement|null }) {
  return (
    <>
      {calc.dataWarnings&&calc.dataWarnings.length>0&&(
        <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-4 space-y-1.5">
          <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide mb-2">Data notes</div>
          {calc.dataWarnings.map((w,i)=>(<div key={i} className="flex items-start gap-2"><Info className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0"/><div className="text-[12px] text-amber-800">{w}</div></div>))}
        </div>
      )}
      {calc.vsResult&&(
        <div className="rounded-lg border border-ink-200/60 bg-canvas-soft p-4 flex items-center justify-between">
          <div className="text-[12.5px] text-ink-600"><span className="font-medium text-ink-900">Vs deal result:</span> {calc.vsResult.winner==="guarantee"?`Guarantee wins — $${calc.vsResult.guaranteeSide.toLocaleString()} > % side $${calc.vsResult.percentageSide.toFixed(2)}`:`% of net wins — $${calc.vsResult.percentageSide.toFixed(2)} > guarantee $${calc.vsResult.guaranteeSide.toLocaleString()}`}</div>
          <PlainBadge variant={calc.vsResult.winner==="percentage"?"brand":"default"}>{calc.vsResult.winner==="guarantee"?"Guarantee floor":"% of net"}</PlainBadge>
        </div>
      )}
      <div className="text-center py-10 mb-2">
        <div className="eyebrow text-[10px] text-ink-400 mb-3">Total to artist</div>
        <div className="text-[72px] font-mono tabular font-bold text-ink-900 leading-none" style={{ letterSpacing:"-0.03em" }}>{formatMoney(calc.totalToArtist)}</div>
        {existingSettlement&&<div className="mt-3">{existingSettlement.status==="paid"?<PlainBadge variant="brand">Paid</PlainBadge>:existingSettlement.status==="signed"||existingSettlement.status==="finalized"?<PlainBadge variant="brand">Signed</PlainBadge>:existingSettlement.status==="disputed"?<PlainBadge variant="rose">Disputed</PlainBadge>:null}</div>}
        {existingSettlement?.totalToArtist!=null&&Math.abs(existingSettlement.totalToArtist-calc.totalToArtist)>1&&(
          <div className="text-[12px] text-ink-400 mt-2">Previously settled at <span className="font-mono tabular text-ink-600">{formatMoney(existingSettlement.totalToArtist)}</span> — difference of <span className="font-mono tabular text-amber-700">{formatMoney(Math.abs(existingSettlement.totalToArtist-calc.totalToArtist))}</span></div>
        )}
      </div>
      <Card accent="brand">
        <CardHeader><div><CardTitle>Settlement worksheet</CardTitle><CardDescription className="font-mono">{calc.finalFormula}</CardDescription></div></CardHeader>
        <CardContent className="divide-y divide-ink-100/80">
          <Row label="Gross box office" value={formatMoney(calc.grossBoxOffice)} />
          <Row label="Net box office" value={formatMoney(calc.netBoxOffice)} />
          <Row label="Total expenses (passed through)" value={formatMoney(calc.totalExpenses)} />
          <div className="pt-3" />
          {calc.steps.map((step,i)=>(<Row key={i} label={step.label} value={step.value<0?`(${formatMoney(Math.abs(step.value))})`:formatMoney(step.value)} note={step.note} negative={step.value<0} />))}
          <div className="pt-3" />
          <div className="flex items-baseline justify-between py-3 font-semibold">
            <span className="text-[13px] text-ink-900">Total to artist</span>
            <span className="text-[18px] font-mono tabular text-ink-900">{formatMoney(calc.totalToArtist)}</span>
          </div>
        </CardContent>
      </Card>
      {calc.bonusesNotTriggered.length>0&&(
        <Card>
          <CardHeader><CardTitle>Bonuses not triggered</CardTitle><CardDescription>Bonuses that did not hit — useful when the agent asks.</CardDescription></CardHeader>
          <CardContent className="divide-y divide-ink-100/80">
            {calc.bonusesNotTriggered.map((b,i)=>(
              <div key={i} className="py-3 flex items-baseline justify-between gap-4">
                <div><div className="text-[13px] text-ink-600">{b.label}</div><div className="text-[11.5px] text-ink-400 mt-0.5">{b.reason}</div></div>
                <div className="text-[12.5px] text-ink-300 font-mono tabular line-through">{formatMoney(b.amount)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function RecoupsSection({ recoups }: { recoups: Recoup[] }) {
  const total=recoups.reduce((s,r)=>s+r.amount,0);
  const hasDisputed=recoups.some(r=>r.status==="disputed");
  return (
    <Card accent={hasDisputed?"rose":undefined}>
      <CardHeader><div><CardTitle>Recoups</CardTitle><CardDescription>Venue costs taken off the top before artist payment.</CardDescription></div><PlainBadge variant={hasDisputed?"rose":"default"}>{formatMoney(total)} total</PlainBadge></CardHeader>
      <CardContent className="divide-y divide-ink-100/80">
        {recoups.map(r=>(
          <div key={r.id} className="py-3.5 grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <div><div className="text-[13px] text-ink-900 leading-tight">{r.label}</div><div className="text-[11.5px] text-ink-400 mt-0.5">{RECOUP_LABELS[r.category]}</div></div>
            <div>{r.status==="disputed"?<PlainBadge variant="rose">Disputed</PlainBadge>:r.status==="withdrawn"?<PlainBadge variant="default">Withdrawn</PlainBadge>:<PlainBadge variant="brand">Agreed</PlainBadge>}</div>
            <div className="text-[13.5px] font-mono tabular text-ink-900 text-right min-w-[80px]">{formatMoney(r.amount)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SignoffSection({ settlement }: { settlement: Settlement }) {
  return (
    <Card><CardHeader><CardTitle>Sign-off & notes</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {settlement.signoffText&&<div><div className="eyebrow text-[10px] text-ink-500 mb-2">From the artist team</div><div className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed">&ldquo;{settlement.signoffText}&rdquo;</div></div>}
        {settlement.notes&&<div><div className="eyebrow text-[10px] text-ink-500 mb-2">Mariana&apos;s settlement notes</div><div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-4 ring-1 ring-ink-200/60 leading-relaxed">{settlement.notes}</div></div>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, note, negative }: { label: string; value: string; note?: string; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <div><div className="text-[13px] text-ink-600">{label}</div>{note&&<div className="text-[11.5px] text-ink-400 mt-0.5 max-w-md leading-snug">{note}</div>}</div>
      <div className={`text-[13.5px] font-mono tabular ${negative?"text-rose-700":"text-ink-900"}`}>{value}</div>
    </div>
  );
}
