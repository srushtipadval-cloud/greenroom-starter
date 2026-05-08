import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAllShows } from "@/lib/queries";
import { StatusBadge, DealTypeBadge, PlainBadge } from "@/components/ui/badge";
import {
  formatShowDate,
  formatMoneyCompact,
  relativeShowDate,
} from "@/lib/format";

export default async function ShowsPage() {
  const rows = await getAllShows();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = rows.filter((r) => new Date(r.show.date) >= today);
  const past = rows
    .filter((r) => new Date(r.show.date) < today)
    .reverse();

  const upcomingShown = upcoming.slice(0, 30);
  const recentShown = past.slice(0, 10);

  const settledCount = past.filter((r) => r.settlement).length;
  const totalToArtists = past.reduce(
    (sum, r) => sum + (r.settlement?.totalToArtist ?? 0),
    0,
  );

  return (
    <div className="px-10 py-8 max-w-6xl">
      {/* Hero */}
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700 mb-2">
        The Crescent · Nashville · 650 cap
      </div>
      <h1 className="text-[32px] font-semibold text-ink-900 tracking-tight leading-none">
        Shows
      </h1>
      <p className="text-[14px] text-ink-500 mt-2.5 max-w-xl">
        Mariana&apos;s home view. {upcoming.length} upcoming, {past.length}{" "}
        completed in the last 18 months.
      </p>

      {/* Stats row — cream-toned cards on cream canvas, more presence */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
        <Stat label="Upcoming" value={String(upcoming.length)} />
        <Stat label="Past 18 mo" value={String(past.length)} />
        <Stat label="Settled" value={String(settledCount)} accent="brand" />
        <Stat
          label="Paid to artists"
          value={formatMoneyCompact(totalToArtists)}
          mono
        />
      </div>

      <div className="mt-10">
        <Section
          title="Upcoming"
          subtitle={
            upcomingShown.length > 0
              ? `Next ${upcomingShown.length}`
              : "No upcoming shows"
          }
          rows={upcomingShown}
          emptyText="No upcoming shows on the books."
        />
      </div>

      <div className="mt-10">
        <Section
          title="Recent"
          subtitle={`Last ${recentShown.length}`}
          rows={recentShown}
          emptyText="No completed shows yet."
        />
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
        accent === "brand"
          ? "border-brand-200"
          : "border-ink-200"
      }`}
    >
      {accent === "brand" && (
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-brand-500 to-brand-700 rounded-t-xl" />
      )}
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div
        className={`text-[24px] font-semibold text-ink-900 mt-1 tracking-tight ${
          mono ? "font-mono tabular" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  rows,
  emptyText,
}: {
  title: string;
  subtitle: string;
  rows: Awaited<ReturnType<typeof getAllShows>>;
  emptyText: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-ink-900">{title}</h2>
        <span className="text-[12px] text-ink-500">{subtitle}</span>
      </div>
      <div className="rounded-xl border border-ink-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(20,15,8,0.04),0_4px_12px_rgba(20,15,8,0.04)]">
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-[13px] text-ink-500 text-center">
            {emptyText}
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map(({ show, artist, deal, settlement }) => (
              <li key={show.id}>
                <Link
                  href={`/shows/${show.id}`}
                  className="grid grid-cols-[88px_1fr_auto_auto] items-center gap-4 px-5 py-3.5 hover:bg-canvas-soft transition-colors group"
                >
                  <div>
                    <div className="text-[13px] font-medium text-ink-900">
                      {formatShowDate(show.date)}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      {relativeShowDate(show.date)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-ink-900 truncate">
                      {artist?.name ?? "—"}
                    </div>
                    <div className="text-[11.5px] text-ink-500 mt-1 flex items-center gap-2">
                      {deal && <DealTypeBadge type={deal.dealType} />}
                      {deal?.guaranteeAmount != null && (
                        <span className="font-mono tabular">
                          {formatMoneyCompact(deal.guaranteeAmount)}
                          {deal.dealType === "vs" ? " min" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right pr-2">
                    {settlement?.totalToArtist != null && (
                      <>
                        <div className="text-[10px] text-ink-500 uppercase tracking-wider">
                          To artist
                        </div>
                        <div className="text-[13px] font-mono tabular font-medium text-ink-900">
                          {formatMoneyCompact(settlement.totalToArtist)}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {settlement ? (
                      <SettlementLifecyclePill status={settlement.status} />
                    ) : (
                      <StatusBadge status={show.status} />
                    )}
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-400 group-hover:text-ink-700 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const lifecycleStatusVariants: Record<
  string,
  { variant: "default" | "amber" | "brand" | "rose" | "sky"; label: string }
> = {
  draft: { variant: "default", label: "Draft" },
  submitted: { variant: "sky", label: "Submitted" },
  in_review: { variant: "sky", label: "In review" },
  signed: { variant: "brand", label: "Signed" },
  disputed: { variant: "rose", label: "Disputed" },
  revised: { variant: "amber", label: "Revised" },
  finalized: { variant: "brand", label: "Finalized" },
  paid: { variant: "brand", label: "Paid" },
  voided: { variant: "default", label: "Voided" },
};

function SettlementLifecyclePill({ status }: { status: string }) {
  const v = lifecycleStatusVariants[status] ?? {
    variant: "default" as const,
    label: status,
  };
  return <PlainBadge variant={v.variant}>{v.label}</PlainBadge>;
}
