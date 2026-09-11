import Link from "next/link";
import { AlertTriangle, Building2, DoorOpen, Euro, LifeBuoy, PercentCircle, Wrench } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import { getDashboardData } from "@/app/(app)/actions/dashboard";

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

export default async function DashboardPage() {
	const t = await getT();
	const data = await getDashboardData();

	const cards = [
		{
			title: t("dashboard.cards.properties.title"),
			value: data.propertiesCount.toString(),
			description: t("dashboard.cards.properties.description", { count: data.tenantsCount }),
			icon: Building2,
		},
		{
			title: t("dashboard.cards.units.title"),
			value: data.unitsCount.toString(),
			description: t("dashboard.cards.units.description", { occupied: data.occupiedUnitsCount, vacant: data.vacantUnitsCount }),
			icon: DoorOpen,
		},
		{
			title: t("dashboard.cards.vacancyRate.title"),
			value: formatPercent(data.vacancyRate),
			description: t("dashboard.cards.vacancyRate.description", { vacant: data.vacantUnitsCount, total: data.unitsCount }),
			icon: PercentCircle,
		},
		{
			title: t("dashboard.cards.totalRent.title"),
			value: formatCurrency(data.totalRent),
			description: t("dashboard.cards.totalRent.description", {
				baseRent: formatCurrency(data.coldRentSum),
				serviceCharges: formatCurrency(data.serviceChargesSum),
			}),
			icon: Euro,
		},
		{
			title: t("dashboard.cards.openTickets.title"),
			value: data.openTicketsCount.toString(),
			description: t("dashboard.cards.openTickets.description"),
			icon: Wrench,
			href: "/tickets",
		},
		{
			title: t("dashboard.cards.rentArrears.title"),
			value: formatCurrency(data.rentArrears),
			description: t("dashboard.cards.rentArrears.description"),
			icon: AlertTriangle,
			href: "/finanzen",
			accent: data.rentArrears > 0,
		},
	];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("dashboard.title")} description={t("dashboard.description")} />

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{cards.map((card) => {
						const content = (
							<Card className={card.accent ? "border-red-200 dark:border-red-900" : undefined}>
								<CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
									<CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
									<card.icon className={`size-4 ${card.accent ? "text-red-600" : "text-muted-foreground"}`} />
								</CardHeader>
								<CardContent>
									<div className={`text-2xl font-bold ${card.accent ? "text-red-600" : ""}`}>{card.value}</div>
									<p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
								</CardContent>
							</Card>
						);

						return card.href ? (
							<Link key={card.title} href={card.href} className="block">
								{content}
							</Link>
						) : (
							<div key={card.title}>{content}</div>
						);
					})}
				</div>

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
									<li key={ticket.id} className="flex items-center justify-between gap-4 px-6 py-3">
										<div>
											<p className="text-sm font-medium">{ticket.title}</p>
										<p className="text-xs text-muted-foreground">
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
										<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${ticketStatusStyles[ticket.status]}`}>{t(ticketStatusLabelKeys[ticket.status])}</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

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
