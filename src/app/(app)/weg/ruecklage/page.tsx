import { PiggyBank } from "lucide-react";

import { getHoa, listHousingChargeAmountsForHoa, listHoasSortedByName, listReserveFundBookings } from "@/data/reserve-fund";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ReserveFundBookingFormDialog } from "@/components/weg/reserve-fund-booking-form-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildReserveFundLedger, calculateHoaWealthReport, reserveFundBookingTypeLabels } from "@/lib/hoa-reserve";

import { deleteReserveFundBookingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RuecklagePage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title="Rücklage" description="Erhaltungsrücklage-Kontobuch je WEG." />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Rücklage" description="Erhaltungsrücklage-Kontobuch je WEG." actions={selectedHoa ? <ReserveFundBookingFormDialog hoaId={selectedHoa.id} /> : undefined} />

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/ruecklage" />

				{!selectedHoa ? (
					<p className="text-sm text-muted-foreground">Wählen Sie oben eine WEG aus, um die Erhaltungsrücklage einzusehen oder zu bearbeiten.</p>
				) : (
					<RuecklageForHoa hoaId={selectedHoa.id} />
				)}
			</div>
		</div>
	);
}

async function RuecklageForHoa({ hoaId }: { hoaId: string }) {
	const hoa = getHoa(hoaId);
	if (!hoa) return null;

	const hoaBookings = listReserveFundBookings(hoaId);
	const housingChargeRows = listHousingChargeAmountsForHoa(hoaId);

	const ledger = buildReserveFundLedger(hoaBookings);
	const wealthReport = calculateHoaWealthReport(hoaBookings, housingChargeRows);

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-sm text-muted-foreground">Erhaltungsrücklage</p>
						<p className="text-2xl font-semibold">{formatCurrency(wealthReport.reserveFundBalance)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-sm text-muted-foreground">Offene Hausgeldforderungen</p>
						<p className="text-2xl font-semibold">{formatCurrency(wealthReport.openReceivables)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-sm text-muted-foreground">Vermögen (vereinfacht)</p>
						<p className="text-2xl font-semibold">{formatCurrency(wealthReport.totalAssets)}</p>
					</CardContent>
				</Card>
			</div>
			<p className="text-xs text-muted-foreground">
				Vereinfachter Vermögensbericht (§ 28 Abs. 4 WEG): Summe aus Erhaltungsrücklage und offenen Hausgeldforderungen. Ersetzt keine vollständige Bankbuchhaltung - der tatsächliche
				Kontostand des Gemeinschaftskontos ist weiterhin außerhalb dieser App zu führen.
			</p>

			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold">Rücklagen-Kontobuch</h2>
			</div>

			<Card>
				<CardContent className="p-0">
					{ledger.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
							<PiggyBank className="size-8" />
							<p>Noch keine Rücklagenbuchungen erfasst.</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Datum</TableHead>
									<TableHead>Bezeichnung</TableHead>
									<TableHead>Art</TableHead>
									<TableHead className="text-right">Betrag</TableHead>
									<TableHead className="text-right">Saldo</TableHead>
									<TableHead className="w-[100px] text-right">Aktionen</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{ledger.map((entry) => {
									const booking = hoaBookings.find((b) => b.id === entry.id);
									return (
										<TableRow key={entry.id}>
											<TableCell className="text-muted-foreground">{formatDate(entry.bookingDate)}</TableCell>
											<TableCell className="font-medium">{entry.description}</TableCell>
											<TableCell className="text-muted-foreground">{reserveFundBookingTypeLabels[entry.type]}</TableCell>
											<TableCell className={`text-right ${entry.type === "WITHDRAWAL" ? "text-red-600" : "text-emerald-600"}`}>
												{entry.type === "WITHDRAWAL" ? "−" : "+"}
												{formatCurrency(entry.amountCents / 100)}
											</TableCell>
											<TableCell className="text-right font-medium">{formatCurrency(entry.balanceCents / 100)}</TableCell>
											<TableCell>
												{booking ? (
													<div className="flex items-center justify-end gap-1">
														<ReserveFundBookingFormDialog hoaId={hoaId} booking={booking} />
														<ConfirmDeleteButton action={deleteReserveFundBookingAction.bind(null, booking.id, hoaId)} confirmMessage="Diese Buchung wirklich löschen?" />
													</div>
												) : null}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
