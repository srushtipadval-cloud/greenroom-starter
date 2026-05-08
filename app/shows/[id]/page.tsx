import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  Clock,
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
import { Button } from "@/components/ui/button";
import { parseBonuses } from "@/lib/dealMath";
import {
  formatMoney,
  formatMoneyCompact,
  formatShowDateFull,
  relativeShowDate,
} from "@/lib/format";
import type { Bonus } from "@/db/schema";

const COMP_LABELS: Record<string, string> = {
  artist_gl: "Artist guest list",
  label: "Label / management",
  press: "Press",
  venue_staff: "Venue staff",
  sponsor: "Sponsor",
  promo: "Promo / radio",
  other: "Other",
};

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const {
    show,
    artist,
    agent,
    agency,
    deal,
    settlement,
    ticketSales,
    expenses,
    comps,
  } = data;

  const grossSoFar = ticketSales.reduce((sum, t) => sum + t.gross, 0);
  const totalFees = ticketSales.reduce((sum, t) => sum + t.fees, 0);
  const totalTickets = ticketSales.reduce((sum, t) => sum + (t.qty ?? 0), 0);
  const totalExpenses = expenses
    .filter((e) => !e.absorbedByVenue)
    .reduce((sum, e) => sum + e.amount, 0);
  const absorbedTotal = expenses
    .filter((e) => e.absorbedByVenue)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCompCount = comps.reduce((s, c) => s + c.count, 0);
  const compsCountingTowardGross = comps
    .filter((c) => c.countsTowardGross)
    .reduce((s, c) => s + c.count, 0);

  const bonuses = deal ? parseBonuses(deal) : [];

  return (
    <div className="px-10 py-8 max-w-5xl">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-ink-900 mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All shows
      </Link>

      {/* Hero header */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <StatusBadge status={show.status} />
            {deal && <DealTypeBadge type={deal.dealType} />}
            {settlement?.status === "disputed" && (
              <PlainBadge variant="rose">Disputed</PlainBadge>
            )}
            {bonuses.length > 0 && (
              <PlainBadge variant="brand">
                {bonuses.length} bonus{bonuses.length === 1 ? "" : "es"}
              </PlainBadge>
            )}
          </div>
          <h1 className="text-[32px] font-semibold text-ink-900 tracking-tight leading-none">
            {artist?.name ?? "—"}
          </h1>
          <div className="text-[13.5px] text-ink-500 mt-2 flex items-center gap-1.5">
            {formatShowDateFull(show.date)} ·{" "}
            <span className="text-ink-400">
              {relativeShowDate(show.date)}
            </span>
            <span className="text-ink-300">·</span>
            <Clock className="h-3 w-3" />
            doors {show.doorsTime} · set {show.setTime}
          </div>
        </div>
        <Link href={`/shows/${show.id}/settle`}>
          <Button variant="brand" size="lg">
            <FileSpreadsheet className="h-4 w-4" />
            {settlement ? "View settlement" : "Settle show"}
          </Button>
        </Link>
      </div>

      {show.internalNotes && (
        <div className="mb-5 rounded-lg bg-amber-50 ring-1 ring-amber-200 p-4 flex gap-3">
          <AlertCircle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-800 mb-1">
              Mariana&apos;s notes
            </div>
            <div className="text-[13px] text-ink-800 leading-relaxed">
              {show.internalNotes}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Deal terms (now with bonuses sub-section) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Deal terms</CardTitle>
              <CardDescription>
                What was negotiated. Mariana enters this from the email
                thread with the agent.
              </CardDescription>
            </div>
            {deal && <DealTypeBadge type={deal.dealType} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {deal ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Field
                    label="Guarantee"
                    mono
                    value={
                      deal.guaranteeAmount != null
                        ? formatMoney(deal.guaranteeAmount)
                        : "—"
                    }
                  />
                  <Field
                    label="Percentage"
                    mono
                    value={
                      deal.percentage != null
                        ? `${(deal.percentage * 100).toFixed(0)}% ${deal.percentageBasis ? `of ${deal.percentageBasis}` : ""}`
                        : "—"
                    }
                  />
                  <Field
                    label="Expense cap"
                    mono
                    value={
                      deal.expenseCap != null
                        ? formatMoney(deal.expenseCap)
                        : "—"
                    }
                  />
                  <Field
                    label="Hospitality cap"
                    mono
                    value={
                      deal.hospitalityCap != null
                        ? formatMoney(deal.hospitalityCap)
                        : "—"
                    }
                  />
                </div>

                {/* Structured bonuses */}
                {bonuses.length > 0 && (
                  <div className="rounded-lg ring-1 ring-brand-200 bg-brand-50/40 p-3.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="h-3.5 w-3.5 text-brand-700" />
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-800">
                        Bonuses & escalators (structured)
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {bonuses.map((b, i) => (
                        <li
                          key={i}
                          className="text-[12.5px] text-ink-800 flex items-start gap-2"
                        >
                          <BonusBadge type={b.type} />
                          <span className="leading-relaxed">{b.label}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-[11px] text-ink-500 mt-2.5 leading-snug">
                      Stored in{" "}
                      <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded ring-1 ring-ink-200">
                        bonuses_json
                      </code>
                      . The in-app tool only reads structured bonuses — anything
                      in the prose below is invisible to it.
                    </div>
                  </div>
                )}

                {deal.dealNotesFreetext && (
                  <div>
                    <div className="text-[10.5px] font-medium text-ink-500 uppercase tracking-wider mb-1.5">
                      Deal notes (free text — what Mariana actually trusts)
                    </div>
                    <div className="text-[13px] text-ink-800 bg-canvas-soft rounded-lg p-3.5 ring-1 ring-ink-200 leading-relaxed">
                      {deal.dealNotesFreetext}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-[13px] text-ink-500">
                No deal entered yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Artist + agent */}
        <Card>
          <CardHeader>
            <CardTitle>Artist & agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <Field label="Artist" value={artist?.name ?? "—"} />
            <Field
              label="Genre"
              value={
                <span className="capitalize">{artist?.genre ?? "—"}</span>
              }
            />
            <Field
              label="Prior shows here"
              value={String(artist?.priorShowCount ?? 0)}
              mono
            />
            <Field
              label="Agent"
              value={
                agent
                  ? `${agent.name}${agency ? ` · ${agency.name}` : ""}`
                  : "—"
              }
            />
            {agent?.preferencesNotes && (
              <div>
                <div className="text-[10.5px] font-medium text-ink-500 uppercase tracking-wider mb-1.5">
                  Agent notes
                </div>
                <div className="text-[12.5px] text-ink-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 leading-relaxed">
                  {agent.preferencesNotes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Box office */}
        <Card>
          <CardHeader>
            <CardTitle>Box office</CardTitle>
            <CardDescription>From integrated ticketing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-[10.5px] font-medium text-ink-500 uppercase tracking-wider">
                  Gross
                </div>
                <div className="text-[28px] font-semibold font-mono tabular text-ink-900 tracking-tight mt-0.5 leading-none">
                  {formatMoneyCompact(grossSoFar)}
                </div>
              </div>
              {totalTickets > 0 ? (
                <div className="text-[12px] text-ink-600 pt-3 border-t border-ink-100 leading-relaxed">
                  <span className="font-mono tabular font-medium">
                    {totalTickets}
                  </span>{" "}
                  tickets ·{" "}
                  <span className="font-mono tabular">
                    {formatMoney(totalFees)}
                  </span>{" "}
                  in fees
                  <div className="mt-1 text-ink-500">
                    Net{" "}
                    <span className="font-mono tabular text-ink-700">
                      {formatMoneyCompact(grossSoFar - totalFees)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-ink-500 pt-3 border-t border-ink-100">
                  No sales yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comps */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Comps</CardTitle>
              <CardDescription>
                {totalCompCount} comp tickets across {comps.length}{" "}
                categor{comps.length === 1 ? "y" : "ies"}.
                {compsCountingTowardGross > 0 && (
                  <>
                    {" "}
                    <span className="text-amber-700 font-medium">
                      {compsCountingTowardGross} count toward gross.
                    </span>
                  </>
                )}
              </CardDescription>
            </div>
            <PlainBadge variant="default">
              {totalCompCount} total
            </PlainBadge>
          </CardHeader>
          <CardContent>
            {comps.length === 0 ? (
              <div className="text-[13px] text-ink-500">
                No comps recorded for this show.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium text-right">Count</th>
                    <th className="py-2 font-medium text-right">
                      Face value
                    </th>
                    <th className="py-2 font-medium text-right">
                      Counts toward gross?
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {comps.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">
                        {COMP_LABELS[c.category] ?? c.category}
                        {c.notes && (
                          <span className="text-ink-500 ml-1">
                            · {c.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono tabular">
                        {c.count}
                      </td>
                      <td className="py-2 text-right font-mono tabular text-ink-500">
                        {formatMoney(c.faceValue * c.count)}
                      </td>
                      <td className="py-2 text-right">
                        {c.countsTowardGross ? (
                          <span className="text-amber-700 font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="text-ink-500">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="md:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>
                Entered during the week, often incompletely.
              </CardDescription>
            </div>
            {absorbedTotal > 0 && (
              <PlainBadge variant="amber">
                {formatMoney(absorbedTotal)} absorbed
              </PlainBadge>
            )}
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-[13px] text-ink-500">
                No expenses entered yet.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium">Description</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 capitalize">
                        {e.category}
                        {e.absorbedByVenue && (
                          <PlainBadge variant="amber" className="ml-2">
                            absorbed
                          </PlainBadge>
                        )}
                      </td>
                      <td className="py-2 text-ink-500">
                        {e.description ?? "—"}
                      </td>
                      <td className="py-2 text-right font-mono tabular">
                        {formatMoney(e.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="py-2.5" colSpan={2}>
                      Total (passed through)
                    </td>
                    <td className="py-2.5 text-right font-mono tabular">
                      {formatMoney(totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BonusBadge({ type }: { type: Bonus["type"] }) {
  const labels: Record<Bonus["type"], string> = {
    gross_threshold: "gross",
    sellout: "sellout",
    attendance_threshold: "attend",
    tier_ratchet: "ratchet",
  };
  return (
    <span className="inline-flex shrink-0 items-center px-1.5 py-px rounded text-[9.5px] font-mono uppercase tracking-wider bg-white ring-1 ring-brand-200 text-brand-800">
      {labels[type]}
    </span>
  );
}
