import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getReports } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

export default async function ReportsPage() {
  const r = await getReports();

  const dealMix = Object.entries(r.dealTypeCounts)
    .map(([type, count]) => ({
      type,
      count,
      pct: r.totalDeals > 0 ? count / r.totalDeals : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Lifecycle distribution — only show stages with at least one settlement
  const lifecycleOrder = [
    "draft",
    "submitted",
    "in_review",
    "signed",
    "disputed",
    "revised",
    "finalized",
    "paid",
    "voided",
  ];
  const lifecycleData = lifecycleOrder
    .map((stage) => ({
      stage,
      count: r.settlementStatus[stage] ?? 0,
      pct: r.totalSettlements > 0
        ? (r.settlementStatus[stage] ?? 0) / r.totalSettlements
        : 0,
    }))
    .filter((d) => d.count > 0);

  const inFlight =
    (r.settlementStatus.draft ?? 0) +
    (r.settlementStatus.submitted ?? 0) +
    (r.settlementStatus.in_review ?? 0) +
    (r.settlementStatus.signed ?? 0) +
    (r.settlementStatus.finalized ?? 0);

  return (
    <div className="px-10 py-8 max-w-5xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700 mb-2">
        Last 18 months
      </div>
      <h1 className="text-[32px] font-semibold text-ink-900 tracking-tight leading-none">
        Reports
      </h1>
      <p className="text-[14px] text-ink-500 mt-2.5 max-w-xl">
        Aggregate metrics for The Crescent. The numbers the CEO is watching.
      </p>

      {/* CEO memo callout */}
      <div className="mt-7 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-canvas-soft p-5 flex gap-4">
        <div className="w-9 h-9 rounded-lg bg-white ring-1 ring-amber-200 flex items-center justify-center shrink-0 shadow-sm">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 mb-1.5">
            From Pri&apos;s Q4 memo
          </div>
          <p className="text-[13.5px] text-ink-800 leading-relaxed">
            &ldquo;Our settlement experience is the place we are most clearly
            losing on craft. Our customers love us in spite of it, not because
            of it.&rdquo;{" "}
            <Link
              href="/context"
              className="font-medium text-brand-700 hover:text-brand-800 hover:underline inline-flex items-center gap-0.5"
            >
              Read the full memo
              <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Stat label="Shows in window" value={String(r.showCount)} />
        <Stat label="Settled" value={String(r.settledCount)} accent="brand" />
        <Stat
          label="Gross box office"
          value={formatMoneyCompact(r.totalGross)}
          mono
        />
        <Stat
          label="Paid to artists"
          value={formatMoneyCompact(r.totalToArtists)}
          mono
        />
      </div>

      {/* Settlement craft gap */}
      <h2 className="text-[14px] font-semibold text-ink-900 mt-10 mb-3">
        Settlement craft gap
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BigMetric
          label="Deal types supported by tool"
          value={`${(r.inAppToolUsageRate * 100).toFixed(0)}%`}
          subtext={`At The Crescent, ${(100 - r.inAppToolUsageRate * 100).toFixed(0)}% of deals — Vs deals, % of net, and door deals — are deal types the in-app tool can't settle. Across all customers, only about 18% actively use the tool at all.`}
        />
        <BigMetric
          label="Disputed settlements"
          value={`${(r.disputedRate * 100).toFixed(1)}%`}
          subtext={`${r.settlementStatus.disputed ?? 0} of ${r.totalSettlements} past settlements ended in some form of dispute — either a withheld signature or a back-and-forth that altered the final number.`}
        />
      </div>

      {/* Settlement lifecycle distribution */}
      <h2 className="text-[14px] font-semibold text-ink-900 mt-10 mb-3">
        Settlement lifecycle
      </h2>
      <p className="text-[12.5px] text-ink-600 mb-3 max-w-2xl leading-relaxed">
        Where the {r.totalSettlements} settlements at The Crescent currently
        sit. {inFlight} are still in flight — drafted but not yet paid.
      </p>
      <Card>
        <CardContent>
          <div className="space-y-2.5">
            {lifecycleData.map(({ stage, count, pct }) => {
              const isProblem =
                stage === "disputed" || stage === "revised" || stage === "voided";
              const isDone = stage === "paid";
              return (
                <div key={stage}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[12.5px] font-medium text-ink-900 capitalize">
                      {stage.replace(/_/g, " ")}
                    </span>
                    <div className="text-[12.5px] text-ink-700 font-mono tabular">
                      {count}
                      <span className="text-ink-400">
                        {" "}
                        · {(pct * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className={
                        isProblem
                          ? "h-full bg-gradient-to-r from-rose-300 to-rose-500"
                          : isDone
                            ? "h-full bg-gradient-to-r from-brand-500 to-brand-700"
                            : "h-full bg-gradient-to-r from-sky-300 to-sky-500"
                      }
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recoups */}
      {r.settlementsWithRecoups > 0 && (
        <>
          <h2 className="text-[14px] font-semibold text-ink-900 mt-10 mb-3">
            Recoups
          </h2>
          <p className="text-[12.5px] text-ink-600 mb-3 max-w-2xl leading-relaxed">
            Venue costs taken off the top before artist payment. The most
            frequent source of settlement disputes — exactly the seam in the
            Coastal Spell thread.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SmallMetric
              label="Settlements with recoups"
              value={String(r.settlementsWithRecoups)}
              subtext={`${((r.settlementsWithRecoups / r.totalSettlements) * 100).toFixed(0)}% of past settlements`}
            />
            <SmallMetric
              label="Total recouped"
              value={formatMoneyCompact(r.totalRecoupValue)}
              mono
            />
            <SmallMetric
              label="Disputed recoup value"
              value={formatMoney(r.disputedRecoupValue)}
              mono
              alarming={r.disputedRecoupValue > 0}
            />
          </div>
        </>
      )}

      {/* Comps */}
      <h2 className="text-[14px] font-semibold text-ink-900 mt-10 mb-3">
        Comps
      </h2>
      <p className="text-[12.5px] text-ink-600 mb-3 max-w-2xl leading-relaxed">
        Comp tickets given away across all shows. Whether comps count toward
        gross is a deal-by-deal call — and a recurring source of friction.
      </p>
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-500">
                Total comp tickets
              </div>
              <div className="text-[22px] font-semibold font-mono tabular text-ink-900 mt-1">
                {r.totalCompTickets.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-500">
                Face value foregone
              </div>
              <div className="text-[22px] font-semibold font-mono tabular text-ink-900 mt-1">
                {formatMoneyCompact(r.totalCompFaceValue)}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-500">
                Per show (avg)
              </div>
              <div className="text-[22px] font-semibold font-mono tabular text-ink-900 mt-1">
                {Math.round(r.totalCompTickets / r.showCount)}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(r.compsByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const pct =
                  r.totalCompTickets > 0 ? count / r.totalCompTickets : 0;
                const labels: Record<string, string> = {
                  artist_gl: "Artist guest list",
                  label: "Label / management",
                  press: "Press",
                  venue_staff: "Venue staff",
                  sponsor: "Sponsor",
                  promo: "Promo / radio",
                  other: "Other",
                };
                return (
                  <div key={cat}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[12.5px] text-ink-700">
                        {labels[cat] ?? cat}
                      </span>
                      <div className="text-[12px] text-ink-700 font-mono tabular">
                        {count.toLocaleString()}
                        <span className="text-ink-400">
                          {" "}
                          · {(pct * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ink-400"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Deal mix — kept at the bottom */}
      <h2 className="text-[14px] font-semibold text-ink-900 mt-10 mb-3">
        Deal mix
      </h2>
      <Card>
        <CardContent>
          <div className="space-y-3">
            {dealMix.map(({ type, count, pct }) => {
              const supported =
                type === "flat" || type === "percentage_of_gross";
              const friendly: Record<string, string> = {
                flat: "Flat",
                percentage_of_gross: "% of gross",
                percentage_of_net: "% of net",
                vs: "Vs deal",
                door: "Door deal",
              };
              return (
                <div key={type}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink-900">
                        {friendly[type] ?? type}
                      </span>
                      {supported ? (
                        <span className="text-[10px] text-brand-700 uppercase tracking-wider font-semibold">
                          in tool
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 uppercase tracking-wider font-semibold">
                          spreadsheet
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-ink-700 font-mono tabular">
                      {count}
                      <span className="text-ink-400">
                        {" "}
                        · {(pct * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className={
                        supported
                          ? "h-full bg-gradient-to-r from-brand-500 to-brand-700"
                          : "h-full bg-gradient-to-r from-amber-300 to-amber-500"
                      }
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="text-[11.5px] text-ink-500 mt-4 leading-relaxed">
        {r.dealsWithBonuses} of {r.totalDeals} deals carry structured bonuses
        in {" "}
        <code className="font-mono text-[10.5px] bg-ink-100 px-1 py-0.5 rounded">
          bonuses_json
        </code>
        . An unknown number more sit only in the deal-notes prose.
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "brand";
}) {
  return (
    <div
      className={`relative rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(20,15,8,0.04)] ${
        accent === "brand" ? "border-brand-200" : "border-ink-200"
      }`}
    >
      {accent === "brand" && (
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-brand-500 to-brand-700 rounded-t-xl" />
      )}
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div
        className={`text-[24px] font-semibold mt-1 tracking-tight text-ink-900 ${
          mono ? "font-mono tabular" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  subtext,
  mono = false,
  alarming = false,
}: {
  label: string;
  value: string;
  subtext?: string;
  mono?: boolean;
  alarming?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-[0_1px_2px_rgba(20,15,8,0.04)] ${
        alarming
          ? "border-rose-200 bg-rose-50/50"
          : "border-ink-200 bg-white"
      }`}
    >
      <div
        className={`text-[10.5px] font-medium uppercase tracking-wider ${
          alarming ? "text-rose-700" : "text-ink-500"
        }`}
      >
        {label}
      </div>
      <div
        className={`text-[22px] font-semibold mt-1 tracking-tight ${
          alarming ? "text-rose-700" : "text-ink-900"
        } ${mono ? "font-mono tabular" : ""}`}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-[11.5px] text-ink-500 mt-1.5">{subtext}</div>
      )}
    </div>
  );
}

function BigMetric({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="relative rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/60 to-canvas-soft p-5 shadow-[0_1px_2px_rgba(20,15,8,0.04)]">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-300 to-amber-500 rounded-t-xl" />
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-amber-800">
        {label}
      </div>
      <div className="text-[40px] font-semibold mt-1.5 tracking-tight font-mono tabular text-amber-800 leading-none">
        {value}
      </div>
      <div className="text-[12.5px] text-ink-700 mt-3 leading-relaxed">
        {subtext}
      </div>
    </div>
  );
}
