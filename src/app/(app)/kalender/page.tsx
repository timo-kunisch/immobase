import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { listCalendarEvents } from "@/data/calendar-events";
import { listLeasesWithDetails } from "@/data/leases";
import { listOwnerMeetings } from "@/data/meetings";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EventFormDialog } from "@/components/kalender/event-form-dialog";
import {
	buildCalendarItems,
	buildMonthGrid,
	formatMonthParam,
	groupItemsByDay,
	parseMonthParam,
	shiftMonth,
	toLocalDayKey,
	type CalendarItemKind,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const monthTitleFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

/** Farbgebung der Termin-Arten (Chip im Tagesraster + Legende). */
const KIND_STYLES: Record<Exclude<CalendarItemKind, "MANUAL">, string> = {
	LEASE_START: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900",
	LEASE_END: "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900",
	MEETING: "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900",
};

export default async function KalenderPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
	const { month } = await searchParams;
	const { year, monthIndex } = parseMonthParam(month);

	const grid = buildMonthGrid(year, monthIndex);
	// Sichtbarer Zeitraum = erstes bis letztes Rasterfeld (inkl. Fülltage).
	const range = { from: grid[0].dayKey, to: grid[grid.length - 1].dayKey };

	// Manuelle Ereignisse + Fachdaten für die automatischen Termine laden
	// und daraus die Anzeige-Einträge berechnen.
	const items = buildCalendarItems({
		events: listCalendarEvents(range),
		leases: listLeasesWithDetails(),
		meetings: listOwnerMeetings(),
	});
	const itemsByDay = groupItemsByDay(items);

	const todayKey = toLocalDayKey(new Date());
	const prev = shiftMonth(year, monthIndex, -1);
	const next = shiftMonth(year, monthIndex, 1);
	const monthTitle = monthTitleFormatter.format(new Date(year, monthIndex, 1));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title="Kalender"
				description="Manuelle Ereignisse und automatische Termine (Einzug/Auszug, Versammlungen)."
				actions={<EventFormDialog defaultDate={todayKey} />}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Button variant="outline" size="icon-sm" asChild>
							<Link href={`/kalender?month=${formatMonthParam(prev.year, prev.monthIndex)}`} aria-label="Vorheriger Monat" title="Vorheriger Monat">
								<ChevronLeft className="size-4" />
							</Link>
						</Button>
						<h2 className="min-w-40 text-center text-base font-semibold capitalize">{monthTitle}</h2>
						<Button variant="outline" size="icon-sm" asChild>
							<Link href={`/kalender?month=${formatMonthParam(next.year, next.monthIndex)}`} aria-label="Nächster Monat" title="Nächster Monat">
								<ChevronRight className="size-4" />
							</Link>
						</Button>
					</div>
					<Button variant="outline" size="sm" asChild>
						<Link href="/kalender">Heute</Link>
					</Button>
				</div>

				<div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
					{WEEKDAY_LABELS.map((label) => (
						<div key={label} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
							{label}
						</div>
					))}
					{grid.map((day) => {
						const dayItems = itemsByDay.get(day.dayKey) ?? [];
						return (
							<div
								key={day.dayKey}
								className={cn("flex min-h-24 flex-col gap-1 bg-card p-1.5", !day.inMonth && "bg-muted/40 text-muted-foreground")}
							>
								<span
									className={cn(
										"flex size-6 items-center justify-center rounded-full text-xs",
										day.dayKey === todayKey ? "bg-primary font-semibold text-primary-foreground" : "text-foreground",
										!day.inMonth && "text-muted-foreground"
									)}
								>
									{day.dayOfMonth}
								</span>
								<div className="flex max-h-24 flex-col gap-0.5 overflow-y-auto">
									{dayItems.map((item, index) =>
										item.kind === "MANUAL" && item.event ? (
											<EventFormDialog key={`${item.event.id}-${index}`} event={item.event} />
										) : (
											<Link
												key={`${item.kind}-${item.href}-${index}`}
												href={item.href ?? "/kalender"}
												title={item.subtitle ? `${item.title}\n${item.subtitle}` : item.title}
												className={cn("block truncate rounded px-1.5 py-0.5 text-xs font-medium", KIND_STYLES[item.kind as Exclude<CalendarItemKind, "MANUAL">])}
											>
												{item.title}
											</Link>
										)
									)}
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<span className="inline-block size-2.5 rounded-sm bg-primary/60" /> Eigenes Ereignis (bearbeitbar per Klick)
					</span>
					<span className="flex items-center gap-1.5">
						<span className="inline-block size-2.5 rounded-sm bg-emerald-500/60" /> Einzug (Mietbeginn)
					</span>
					<span className="flex items-center gap-1.5">
						<span className="inline-block size-2.5 rounded-sm bg-orange-500/60" /> Auszug (Mietende)
					</span>
					<span className="flex items-center gap-1.5">
						<span className="inline-block size-2.5 rounded-sm bg-violet-500/60" /> Eigentümerversammlung
					</span>
				</div>
			</div>
		</div>
	);
}
