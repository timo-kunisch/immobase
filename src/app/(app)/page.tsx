import Link from "next/link";
import {
	AlertTriangle,
	Building2,
	Calculator,
	ChartColumn,
	DoorOpen,
	Euro,
	FileSignature,
	FileText,
	FolderOpen,
	Landmark,
	LifeBuoy,
	PercentCircle,
	PiggyBank,
	UserSquare2,
	Users,
	Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import { getDashboardData } from "@/app/(app)/actions/dashboard";
import { cn } from "@/lib/utils";

// Immer dynamisch rendern: Die Kennzahlen werden live aus der Datenbank
// geladen und sollen weder beim Build noch zwischen Requests zwischengespeichert werden.
export const dynamic = "force-dynamic";

const ticketStatusLabelKeys: Record<string, MessageKey> = {
	OPEN: "tickets.status.OPEN",
	IN_PROGRESS: "tickets.status.IN_PROGRESS",
};

const ticketStatusStyles: Record<string, string> = {
	OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
};

/** Farbpunkte der Termin-Arten - gleiche Farben wie die Legende auf /kalender. */
const eventKindDotStyles: Record<string, string> = {
	MANUAL: "bg-primary/60",
	LEASE_START: "bg-emerald-500/60",
	LEASE_END: "bg-orange-500/60",
	MEETING: "bg-violet-500/60",
};

/** Eine klickbare Kennzahlen-Karte - führt immer in das zugehörige Modul. */
interface DashboardCard {
	title: string;
	value: string;
	description: string;
	icon: ComponentType<{ className?: string }>;
	href: string;
	/** Hervorhebung als Warnung (z. B. Rückstände > 0). */
	accent?: boolean;
}

function DashboardCardLink({ card }: { card: DashboardCard }) {
	return (
		<Link href={card.href} className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
			<Card
				className={cn(
					"h-full transition-colors group-hover:bg-accent/40 group-hover:ring-primary/30",
					card.accent && "border-red-200 ring-red-200 dark:border-red-900 dark:ring-red-900"
				)}
			>
				<CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground">{card.title}</CardTitle>
					<card.icon className={cn("size-4", card.accent ? "text-red-600" : "text-muted-foreground")} />
				</CardHeader>
				<CardContent>
					<div className={cn("text-2xl font-bold", card.accent && "text-red-600")}>{card.value}</div>
					<p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
				</CardContent>
			</Card>
		</Link>
	);
}

/** Sektions-Überschrift über einer Gruppe von Kennzahlen-Karten. */
function SectionHeading({ title }: { title: string }) {
	return <h2 className="text-base font-semibold">{title}</h2>;
}

export default async function DashboardPage() {
	const t = await getT();
	const data = await getDashboardData({
		leaseStart: t("calendar.labels.leaseStart"),
		leaseEnd: t("calendar.labels.leaseEnd"),
		meeting: t("calendar.labels.meeting"),
	});

	// Allgemeine Kennzahlen (unabhängig davon, ob vermietet und/oder WEG).
	const generalCards: DashboardCard[] = [
		{
			title: t("dashboard.cards.properties.title"),
			value: data.propertiesCount.toString(),
			description: t("dashboard.cards.properties.description", { units: data.unitsCount, hoas: data.hoasCount }),
			icon: Building2,
			href: "/liegenschaften",
		},
		{
			title: t("dashboard.cards.units.title"),
			value: data.unitsCount.toString(),
			description: t("dashboard.cards.units.description", { occupied: data.occupiedUnitsCount, vacant: data.vacantUnitsCount }),
			icon: DoorOpen,
			href: "/einheiten",
		},
		{
			title: t("dashboard.cards.openTickets.title"),
			value: data.openTicketsCount.toString(),
			description: t("dashboard.cards.openTickets.description"),
			icon: Wrench,
			href: "/tickets",
		},
		{
			title: t("dashboard.cards.documents.title"),
			value: data.documentsCount.toString(),
			description: t("dashboard.cards.documents.description"),
			icon: FolderOpen,
			href: "/dokumente",
		},
	];

	// Kennzahlen der Mietverwaltung.
	const rentalCards: DashboardCard[] = [
		{
			title: t("dashboard.cards.tenants.title"),
			value: data.tenantsCount.toString(),
			description: t("dashboard.cards.tenants.description"),
			icon: Users,
			href: "/mieter",
		},
		{
			title: t("dashboard.cards.activeLeases.title"),
			value: data.activeLeasesCount.toString(),
			description: t("dashboard.cards.activeLeases.description"),
			icon: FileSignature,
			href: "/vertraege",
		},
		{
			title: t("dashboard.cards.totalRent.title"),
			value: formatCurrency(data.totalRent),
			description: t("dashboard.cards.totalRent.description", {
				baseRent: formatCurrency(data.coldRentSum),
				serviceCharges: formatCurrency(data.serviceChargesSum),
			}),
			icon: Euro,
			href: "/finanzen",
		},
		{
			title: t("dashboard.cards.vacancyRate.title"),
			value: formatPercent(data.vacancyRate),
			description: t("dashboard.cards.vacancyRate.description", { vacant: data.vacantUnitsCount, total: data.unitsCount }),
			icon: PercentCircle,
			href: "/einheiten",
		},
		{
			title: t("dashboard.cards.rentArrears.title"),
			value: formatCurrency(data.rentArrears),
			description: t("dashboard.cards.rentArrears.description"),
			icon: AlertTriangle,
			href: "/finanzen",
			accent: data.rentArrears > 0,
		},
		{
			title: t("dashboard.cards.draftBillingPeriods.title"),
			value: data.draftBillingPeriodsCount.toString(),
			description: t("dashboard.cards.draftBillingPeriods.description"),
			icon: Calculator,
			href: "/abrechnung",
		},
	];

	// Kennzahlen der WEG-Verwaltung.
	const hoaCards: DashboardCard[] = [
		{
			title: t("dashboard.cards.hoas.title"),
			value: data.hoasCount.toString(),
			description: t("dashboard.cards.hoas.description"),
			icon: Landmark,
			href: "/weg",
		},
		{
			title: t("dashboard.cards.owners.title"),
			value: data.ownersCount.toString(),
			description: t("dashboard.cards.owners.description"),
			icon: UserSquare2,
			href: "/weg/eigentuemer",
		},
		{
			title: t("dashboard.cards.housingChargeArrears.title"),
			value: formatCurrency(data.housingChargeArrears),
			description: t("dashboard.cards.housingChargeArrears.description"),
			icon: AlertTriangle,
			href: "/weg/hausgeld",
			accent: data.housingChargeArrears > 0,
		},
		{
			title: t("dashboard.cards.reserveFund.title"),
			value: formatCurrency(data.reserveFundBalance),
			description: t("dashboard.cards.reserveFund.description"),
			icon: PiggyBank,
			href: "/weg/ruecklage",
		},
		{
			title: t("dashboard.cards.draftEconomicPlans.title"),
			value: data.draftEconomicPlansCount.toString(),
			description: t("dashboard.cards.draftEconomicPlans.description"),
			icon: ChartColumn,
			href: "/weg/wirtschaftsplan",
		},
		{
			title: t("dashboard.cards.draftAnnualStatements.title"),
			value: data.draftAnnualStatementsCount.toString(),
			description: t("dashboard.cards.draftAnnualStatements.description"),
			icon: FileText,
			href: "/weg/jahresabrechnung",
		},
	];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("dashboard.title")} description={t("dashboard.description")} />

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<section className="space-y-3">
					<SectionHeading title={t("nav.group.general")} />
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{generalCards.map((card) => (
							<DashboardCardLink key={card.href} card={card} />
						))}
					</div>
				</section>

				<section className="space-y-3">
					<SectionHeading title={t("nav.group.rental")} />
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{rentalCards.map((card) => (
							<DashboardCardLink key={card.href} card={card} />
						))}
					</div>
				</section>

				<section className="space-y-3">
					<SectionHeading title={t("nav.group.hoa")} />
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{hoaCards.map((card) => (
							<DashboardCardLink key={card.href} card={card} />
						))}
					</div>
				</section>

				<div className="grid gap-4 lg:grid-cols-2">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle className="text-base">{t("dashboard.latestTickets.title")}</CardTitle>
							<Link href="/tickets" className="text-sm text-primary hover:underline">
								{t("dashboard.latestTickets.allTickets")}
							</Link>
						</CardHeader>
						<CardContent className="p-0">
							{data.latestOpenTickets.length === 0 ? (
								<div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
									<Wrench className="size-8" />
									<p>{t("dashboard.latestTickets.empty")}</p>
								</div>
							) : (
								<ul className="divide-y">
									{data.latestOpenTickets.map((ticket) => (
										// Titel führt auf die Ticket-Detailseite; Liegenschaft/Einheit
										// bleiben eigene Links (verschachtelte Anker sind unzulässig).
										<li key={ticket.id} className="flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-accent/40">
											<div className="min-w-0">
												<Link href={`/tickets/${ticket.id}`} className="text-sm font-medium hover:underline">
													{ticket.title}
												</Link>
												<p className="mt-0.5 truncate text-xs text-muted-foreground">
													{ticket.property ? (
														<Link href={`/liegenschaften#property-${ticket.property.id}`} className="hover:text-foreground hover:underline">
															{ticket.property.name}
														</Link>
													) : (
														t("tickets.fields.noProperty")
													)}
													{ticket.unit ? (
														<>
															{" · "}
															<Link href={`/einheiten#unit-${ticket.unit.id}`} className="hover:text-foreground hover:underline">
																{ticket.unit.label}
															</Link>
														</>
													) : null}{" "}
													· {formatDate(ticket.createdAt)}
												</p>
											</div>
											<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${ticketStatusStyles[ticket.status]}`}>
												{t(ticketStatusLabelKeys[ticket.status])}
											</span>
										</li>
									))}
								</ul>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle className="text-base">{t("dashboard.upcoming.title")}</CardTitle>
							<Link href="/kalender" className="text-sm text-primary hover:underline">
								{t("dashboard.upcoming.allEvents")}
							</Link>
						</CardHeader>
						<CardContent className="p-0">
							{data.upcomingEvents.length === 0 ? (
								<div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
									<ChartColumn className="size-8" />
									<p>{t("dashboard.upcoming.empty")}</p>
								</div>
							) : (
								<ul className="divide-y">
									{data.upcomingEvents.map((event, index) => (
										<li key={`${event.kind}-${event.dayKey}-${index}`}>
											<Link
												href={event.href ?? "/kalender"}
												className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent/40"
												title={t(`calendar.kind.${event.kind}`)}
											>
												<span className={cn("size-2.5 shrink-0 rounded-sm", eventKindDotStyles[event.kind])} />
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium">
														{event.time ? `${event.time} · ` : ""}
														{event.title}
													</p>
													{event.subtitle ? <p className="truncate text-xs text-muted-foreground">{event.subtitle}</p> : null}
												</div>
												<span className="shrink-0 text-xs text-muted-foreground">{formatDate(new Date(`${event.dayKey}T00:00:00`))}</span>
											</Link>
										</li>
									))}
								</ul>
							)}
						</CardContent>
					</Card>
				</div>

				{data.propertiesCount === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
							<Building2 className="size-8" />
							<p>
								{t("dashboard.welcome.textPrefix")} <span className="font-medium text-foreground">{t("dashboard.welcome.propertiesLabel")}</span>{" "}
								{t("dashboard.welcome.textSuffix")}
							</p>
						</CardContent>
					</Card>
				) : null}

				{/* Dezenter Hinweis auf das kostenpflichtige Priority-Support-Angebot
				    (help.immobase.app) - ImmoBase selbst bleibt kostenlos/Open Source.
				    Externer Link: Die Electron-Shell öffnet target="_blank" im
				    Standardbrowser (siehe electron/main/index.ts). */}
				<Card className="border-dashed">
					<CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-start gap-3">
							<LifeBuoy className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">{t("dashboard.support.title")}</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{t("dashboard.support.description")}
								</p>
							</div>
						</div>
						<Button variant="outline" size="sm" className="shrink-0" asChild>
							<a href="https://help.immobase.app" target="_blank" rel="noopener noreferrer">
								{t("dashboard.support.learnMore")}
							</a>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
