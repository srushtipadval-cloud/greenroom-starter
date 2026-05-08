import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileWarning,
  Sparkles,
  ArrowRight,
  Check,
  AlertTriangle,
  Mail,
  Pencil,
  XCircle,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { getShowById } from "@/lib/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
} from "@/components/ui/card";
import { StatusBadge, DealTypeBadge, PlainBadge } from "@/components/ui/badge";
import { calculateSettlement } from "@/lib/dealMath";
import {
  formatMoney,
  formatShowDateFull,
} from "@/lib/format";
import type { Settlement, Recoup } from "@/db/schema";

const RECOUP_LABELS: Record<Recoup["category"], string> = {
  marketing: "Marketing",
  hospitality_overage: "Hospitality overage",
  production_overage: "Production overage",
  prior_advance: "Prior advance",
  damages: "Damages",
  other: "Other",
};

export default async function SettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, deal, ticketSales, expenses, settlement, recoups } =
    data;

  if (!deal) {
    return (
      <div className="px-10 py-8 max-w-3xl">
        <BackLink showId={show.id} />
        <div className="text-[13px] text-ink-500">
          No deal entered for this show. Settlement can&apos;t run yet.
        </div>
      </div>
    );
  }

  const calc = calculateSettlement({
    deal,
    ticketSales,
    expenses,
    venueCapacity: data.venue?.capacity ?? undefined,
  });
  const grossSoFar = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalFees = ticketSales.reduce((sum, t) => sum + t.fees, 0);
  const totalExpenses = expenses
    .filter((e) => !e.absorbedByVenue)
    .reduce((sum, e) => sum + e.amount, 0);

  const disputedRecoups = recoups.filter((r) => r.status === "disputed");

  return (
    <div className="px-10 py-8 max-w-4xl">
      <BackLink showId={show.id} />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-3">
          <StatusBadge status={show.status} />
          <DealTypeBadge type={deal.dealType} />
          {settlement?.status === "disputed" && (
            <PlainBadge variant="rose">Disputed</PlainBadge>
          )}
          {settlement?.status === "voided" && (
            <PlainBadge variant="default">Voided</PlainBadge>
          )}
        </div>
        <h1 className="text-[32px] font-semibold text-ink-900 tracking-tight leading-none">
          Settlement · {artist?.name}
        </h1>
        <div className="text-[13.5px] text-ink-500 mt-2">
          {formatShowDateFull(show.date)}
        </div>
      </div>

      {/* Lifecycle bar — only render if there's a settlement record */}
      {settlement && (
        <LifecycleBar settlement={settlement} disputedRecoups={disputedRecoups.length} />
      )}

      <div className="space-y-5 mt-5">
        {!calc.supported ? (
          <UnsupportedDeal
            dealType={calc.dealType}
            deal={deal}
            existingSettlement={settlement}
            grossSoFar={grossSoFar}
            totalFees={totalFees}
            totalExpenses={totalExpenses}
            ticketCount={ticketSales.reduce((s, t) => s + (t.qty ?? 0), 0)}
            expenseRowCount={expenses.length}
          />
        ) : (
          <SupportedSettlement calc={calc} existingSettlement={settlement} />
        )}

        {/* Recoups */}
        {recoups.length > 0 && <RecoupsSection recoups={recoups} />}

        {/* Sign-off / notes */}
        {settlement && (settlement.signoffText || settlement.notes) && (
          <SignoffSection settlement={settlement} />
        )}
      </div>

      {/* Educational footer */}
      <div className="mt-8 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-canvas-soft p-5">
        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-lg bg-white ring-1 ring-brand-200 flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-4 w-4 text-brand-700" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-ink-900 mb-1">
              You&apos;re looking at the seam this case study is about.
            </div>
            <p className="text-[12.5px] text-ink-700 leading-relaxed">
              Greenroom&apos;s in-app settlement tool was built early in the
              company&apos;s history, when most deals were flat guarantees.
              About 18% of customers actively use it; the other 82% — including
              most of the larger venues — default to spreadsheets. The CEO has
              flagged this as the company&apos;s biggest craft gap.{" "}
              <Link
                href="/context"
                className="text-brand-700 font-medium hover:text-brand-800 hover:underline inline-flex items-center gap-0.5"
              >
                Where to start <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink({ showId }: { showId: string }) {
  return (
    <Link
      href={`/shows/${showId}`}
      className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-5 transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to show
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Lifecycle bar — horizontal stage tracker                            */
/* ------------------------------------------------------------------ */

type Stage = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  timestamp?: Date | null;
};

function LifecycleBar({
  settlement,
  disputedRecoups,
}: {
  settlement: Settlement;
  disputedRecoups: number;
}) {
  // Voided is special — show a single state and skip the rest
  if (settlement.status === "voided") {
    return (
      <div className="rounded-xl border border-ink-200 bg-white px-5 py-4 flex items-center gap-3">
        <XCircle className="h-4 w-4 text-ink-500" />
        <div>
          <div className="text-[13px] font-medium text-ink-900">
            Settlement voided
          </div>
          <div className="text-[11.5px] text-ink-500 mt-0.5">
            The show was cancelled or the settlement was scrapped.
          </div>
        </div>
      </div>
    );
  }

  // The five primary stages, regardless of dispute path
  const stages: Stage[] = [
    {
      key: "draft",
      label: "Drafted",
      icon: Pencil,
      timestamp: settlement.draftedAt,
    },
    {
      key: "submitted",
      label: "Submitted",
      icon: Mail,
      timestamp: settlement.submittedAt,
    },
    {
      key: "review",
      label: "Reviewed",
      icon: TrendingUp,
      timestamp: settlement.reviewStartedAt,
    },
    {
      key: "signed",
      label: settlement.disputedAt ? "Finalized" : "Signed",
      icon: Check,
      timestamp: settlement.finalizedAt ?? settlement.signedAt,
    },
    {
      key: "paid",
      label: "Paid",
      icon: Wallet,
      timestamp: settlement.paidAt,
    },
  ];

  // Determine which stage is "current"
  const currentIndex = (() => {
    switch (settlement.status) {
      case "draft":
        return 0;
      case "submitted":
        return 1;
      case "in_review":
        return 2;
      case "disputed":
      case "signed":
      case "revised":
      case "finalized":
        return 3;
      case "paid":
        return 4;
      default:
        return 0;
    }
  })();

  const isDisputed =
    settlement.status === "disputed" ||
    settlement.status === "revised" ||
    !!settlement.disputedAt;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">
            Settlement lifecycle
          </div>
          {isDisputed && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700">
              <AlertTriangle className="h-3 w-3" />
              {settlement.status === "disputed"
                ? "In dispute"
                : settlement.status === "revised"
                  ? "Revision sent"
                  : "Resolved after dispute"}
              {disputedRecoups > 0 && (
                <span className="text-rose-600">
                  · {disputedRecoups} disputed recoup
                  {disputedRecoups === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1 relative">
          {/* Connecting line */}
          <div className="absolute top-3.5 left-[10%] right-[10%] h-px bg-ink-200" />

          {stages.map((stage, i) => {
            const isComplete = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isFuture = i > currentIndex;
            const Icon = stage.icon;

            const stageDot = (() => {
              if (isComplete) {
                return "bg-brand-700 ring-brand-700 text-white";
              }
              if (isCurrent) {
                return isDisputed
                  ? "bg-rose-50 ring-rose-500 text-rose-700"
                  : "bg-brand-50 ring-brand-700 text-brand-700";
              }
              return "bg-white ring-ink-200 text-ink-400";
            })();

            return (
              <div
                key={stage.key}
                className="flex flex-col items-center text-center"
              >
                <div
                  className={`relative z-10 w-7 h-7 rounded-full ring-2 flex items-center justify-center ${stageDot}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div
                  className={`mt-2 text-[11px] font-medium leading-tight ${
                    isFuture ? "text-ink-400" : "text-ink-900"
                  }`}
                >
                  {stage.label}
                </div>
                <div className="text-[10px] text-ink-500 mt-0.5 font-mono tabular leading-tight min-h-[12px]">
                  {stage.timestamp
                    ? new Date(stage.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Unsupported deal type                                               */
/* ------------------------------------------------------------------ */

function UnsupportedDeal({
  dealType,
  deal,
  existingSettlement,
  grossSoFar,
  totalFees,
  totalExpenses,
  ticketCount,
  expenseRowCount,
}: {
  dealType: string;
  deal: NonNullable<Awaited<ReturnType<typeof getShowById>>>["deal"];
  existingSettlement: NonNullable<
    Awaited<ReturnType<typeof getShowById>>
  >["settlement"];
  grossSoFar: number;
  totalFees: number;
  totalExpenses: number;
  ticketCount: number;
  expenseRowCount: number;
}) {
  const friendly: Record<string, string> = {
    flat: "flat guarantee",
    percentage_of_gross: "percentage of gross",
    percentage_of_net: "percentage of net",
    vs: "vs deal",
    door: "door deal",
  };

  return (
    <>
      <Card accent="amber">
        <CardContent className="py-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200 mb-4 shadow-sm">
            <FileWarning className="h-5 w-5 text-amber-700" />
          </div>
          <h2 className="text-[16px] font-semibold text-ink-900 mb-1.5">
            The in-app tool can&apos;t settle a {friendly[dealType] ?? dealType} yet.
          </h2>
          <p className="text-[13px] text-ink-600 max-w-md mx-auto leading-relaxed">
            Mariana would do this on a Google Sheet at 2am tonight. The inputs
            are below — but the math doesn&apos;t happen here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>What the system has</CardTitle>
            <CardDescription>
              The inputs Mariana would pull together to settle this show.
              They&apos;re here — but disconnected from the deal terms.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field
              label="Gross box office"
              mono
              value={formatMoney(grossSoFar)}
            />
            <Field label="Fees" mono value={formatMoney(totalFees)} />
            <Field
              label="Net box office"
              mono
              value={formatMoney(grossSoFar - totalFees)}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Tickets sold" mono value={String(ticketCount)} />
            <Field
              label="Expenses (line items)"
              mono
              value={String(expenseRowCount)}
            />
            <Field
              label="Expenses (passed through)"
              mono
              value={formatMoney(totalExpenses)}
            />
          </div>

          {deal?.dealNotesFreetext && (
            <div className="mt-5">
              <div className="text-[10.5px] font-medium text-ink-500 uppercase tracking-wider mb-1.5">
                Deal notes (free text — what Mariana actually trusts)
              </div>
              <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-3.5 ring-1 ring-ink-200 leading-relaxed">
                {deal.dealNotesFreetext}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {existingSettlement?.totalToArtist != null && (
        <Card
          accent={existingSettlement.status === "disputed" ? "rose" : "brand"}
        >
          <CardHeader>
            <div>
              <CardTitle>Actually settled (off-platform)</CardTitle>
              <CardDescription>
                Mariana ran this in a spreadsheet. Here&apos;s the result that
                was logged back into Greenroom afterward.
              </CardDescription>
            </div>
            {existingSettlement.status === "disputed" ? (
              <PlainBadge variant="rose">Disputed</PlainBadge>
            ) : (
              <PlainBadge variant="brand">Signed</PlainBadge>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between py-2">
              <span className="text-[13px] text-ink-700">Total to artist</span>
              <span className="text-[28px] font-semibold font-mono tabular text-ink-900 tracking-tight">
                {formatMoney(existingSettlement.totalToArtist)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Supported settlement — with bonuses                                 */
/* ------------------------------------------------------------------ */

function SupportedSettlement({
  calc,
  existingSettlement,
}: {
  calc: Extract<
    ReturnType<typeof calculateSettlement>,
    { supported: true }
  >;
  existingSettlement: NonNullable<
    Awaited<ReturnType<typeof getShowById>>
  >["settlement"];
}) {
  return (
    <>
      <Card accent="brand">
        <CardHeader>
          <div>
            <CardTitle>Settlement worksheet</CardTitle>
            <CardDescription className="font-mono">
              {calc.finalFormula}
            </CardDescription>
          </div>
          {existingSettlement &&
            (existingSettlement.status === "paid" ? (
              <PlainBadge variant="brand">Paid</PlainBadge>
            ) : existingSettlement.status === "signed" ||
              existingSettlement.status === "finalized" ? (
              <PlainBadge variant="brand">Signed</PlainBadge>
            ) : null)}
        </CardHeader>
        <CardContent className="divide-y divide-ink-100">
          <Row
            label="Gross box office"
            value={formatMoney(calc.grossBoxOffice)}
          />
          <Row label="Net box office" value={formatMoney(calc.netBoxOffice)} />
          <Row
            label="Total expenses (passed through)"
            value={formatMoney(calc.totalExpenses)}
          />
          <div className="pt-3" />
          {calc.steps.map((step, i) => (
            <Row
              key={i}
              label={step.label}
              value={formatMoney(step.value)}
              note={step.note}
            />
          ))}
          <div className="pt-3" />
          <div className="flex items-baseline justify-between py-3">
            <span className="text-[13px] font-semibold text-ink-900">
              Total to artist
            </span>
            <span className="text-[32px] font-semibold font-mono tabular text-ink-900 tracking-tight">
              {formatMoney(calc.totalToArtist)}
            </span>
          </div>
          {existingSettlement?.totalToArtist != null && (
            <div className="text-[12px] text-ink-500 pt-2.5">
              Originally settled at{" "}
              <span className="font-mono tabular text-ink-700">
                {formatMoney(existingSettlement.totalToArtist)}
              </span>
              .
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bonuses that DIDN'T trigger — visible context for both parties */}
      {calc.bonusesNotTriggered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bonuses not triggered</CardTitle>
            <CardDescription>
              Structured bonuses on this deal that didn&apos;t hit. Shown for
              transparency — useful when the agent asks &quot;what about that
              gross threshold bonus?&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-ink-100">
            {calc.bonusesNotTriggered.map((b, i) => (
              <div
                key={i}
                className="py-2.5 flex items-baseline justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-700">{b.label}</div>
                  <div className="text-[11.5px] text-ink-500 mt-0.5">
                    {b.reason}
                  </div>
                </div>
                <div className="text-[12.5px] text-ink-400 font-mono tabular line-through">
                  {formatMoney(b.amount)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Recoups — venue costs taken off the top                             */
/* ------------------------------------------------------------------ */

function RecoupsSection({ recoups }: { recoups: Recoup[] }) {
  const total = recoups.reduce((s, r) => s + r.amount, 0);
  const disputedTotal = recoups
    .filter((r) => r.status === "disputed")
    .reduce((s, r) => s + r.amount, 0);
  const hasDisputed = disputedTotal > 0;

  return (
    <Card accent={hasDisputed ? "rose" : undefined}>
      <CardHeader>
        <div>
          <CardTitle>Recoups</CardTitle>
          <CardDescription>
            Venue costs taken off the top before artist payment. Often the
            disputed line items in a settlement.
          </CardDescription>
        </div>
        <PlainBadge variant={hasDisputed ? "rose" : "default"}>
          {formatMoney(total)} total
        </PlainBadge>
      </CardHeader>
      <CardContent className="divide-y divide-ink-100">
        {recoups.map((r) => (
          <div
            key={r.id}
            className="py-3 grid grid-cols-[1fr_auto_auto] items-center gap-3"
          >
            <div className="min-w-0">
              <div className="text-[13px] text-ink-900 leading-tight">
                {r.label}
              </div>
              <div className="text-[11.5px] text-ink-500 mt-0.5">
                {RECOUP_LABELS[r.category]}
              </div>
            </div>
            <div>
              {r.status === "disputed" ? (
                <PlainBadge variant="rose">Disputed</PlainBadge>
              ) : r.status === "withdrawn" ? (
                <PlainBadge variant="default">Withdrawn</PlainBadge>
              ) : (
                <PlainBadge variant="brand">Agreed</PlainBadge>
              )}
            </div>
            <div className="text-[13.5px] font-mono tabular text-ink-900 text-right min-w-[80px]">
              {formatMoney(r.amount)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Sign-off & notes                                                     */
/* ------------------------------------------------------------------ */

function SignoffSection({ settlement }: { settlement: Settlement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-off & notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {settlement.signoffText && (
          <div>
            <div className="text-[10.5px] font-medium text-ink-500 uppercase tracking-wider mb-1.5">
              From the artist team
            </div>
            <div className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-3.5 ring-1 ring-ink-200 leading-relaxed">
              &ldquo;{settlement.signoffText}&rdquo;
            </div>
          </div>
        )}
        {settlement.notes && (
          <div>
            <div className="text-[10.5px] font-medium text-ink-500 uppercase tracking-wider mb-1.5">
              Mariana&apos;s settlement notes
            </div>
            <div className="text-[12.5px] text-ink-800 bg-canvas-soft rounded-lg p-3.5 ring-1 ring-ink-200 leading-relaxed">
              {settlement.notes}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <div>
        <div className="text-[13px] text-ink-700">{label}</div>
        {note && (
          <div className="text-[11.5px] text-ink-500 mt-0.5 max-w-md leading-snug">
            {note}
          </div>
        )}
      </div>
      <div className="text-[13.5px] text-ink-900 font-mono tabular">
        {value}
      </div>
    </div>
  );
}
