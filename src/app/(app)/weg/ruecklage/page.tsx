import { PiggyBank } from "lucide-react";

import { getHoa, listHousingChargeAmountsForHoa, listHoasSortedByName, listReserveFundBookings } from "@/data/reserve-fund";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { ReserveFundBookingFormDialog } from "@/components/weg/reserve-fund-booking-form-dialog";
import { ReserveFundBookingsTable, type ReserveFundBookingRow } from "@/components/weg/reserve-fund-bookings-table";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatCurrency } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { buildReserveFundLedger, calculateHoaWealthReport } from "@/lib/hoa-reserve";

export const dynamic = "force-dynamic";

export default async function RuecklagePage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const t = await getT();
	const { hoaId } = await searchParams;

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaFinance.reserve.title")} description={t("hoaFinance.reserve.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaFinance.noHoas")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaFinance.reserve.title")} description={t("hoaFinance.reserve.description")} actions={selectedHoa ? <ReserveFundBookingFormDialog hoaId={selectedHoa.id} /> : undefined} />

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/ruecklage" />

				{!selectedHoa ? (
					<p className="text-sm text-muted-foreground">{t("hoaFinance.reserve.selectHoa")}</p>
				) : (
					<RuecklageForHoa hoaId={selectedHoa.id} />
				)}
			</div>
		</div>
	);
}

async function RuecklageForHoa({ hoaId }: { hoaId: string }) {
	const t = await getT();
	const hoa = getHoa(hoaId);
	if (!hoa) return null;

	const hoaBookings = listReserveFundBookings(hoaId);
	const housingChargeRows = listHousingChargeAmountsForHoa(hoaId);

	const ledger = buildReserveFundLedger(hoaBookings);
	const wealthReport = calculateHoaWealthReport(hoaBookings, housingChargeRows);

	// Zeilen des Kontobuchs in der chronologischen Ledger-Reihenfolge: je
	// Buchung den laufenden Saldo aus der Ledger-Berechnung einbetten
	// (buildReserveFundLedger durchreicht die IDs der Ursprungsbuchungen,
	// sodass Bearbeiten/Löschen ohne fragile Zuordnung möglich bleibt).
	const bookingById = new Map(hoaBookings.map((booking) => [booking.id, booking]));
	const rows: ReserveFundBookingRow[] = ledger.flatMap((entry) => {
		const booking = bookingById.get(entry.id);
		return booking ? [{ ...booking, amountCents: entry.amountCents, balanceCents: entry.balanceCents }] : [];
	});

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-sm text-muted-foreground">{t("hoaFinance.reserve.stats.reserveFund")}</p>
						<p className="text-2xl font-semibold">{formatCurrency(wealthReport.reserveFundBalance)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-sm text-muted-foreground">{t("hoaFinance.reserve.stats.openReceivables")}</p>
						<p className="text-2xl font-semibold">{formatCurrency(wealthReport.openReceivables)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-sm text-muted-foreground">{t("hoaFinance.reserve.stats.totalAssets")}</p>
						<p className="text-2xl font-semibold">{formatCurrency(wealthReport.totalAssets)}</p>
					</CardContent>
				</Card>
			</div>
			<p className="text-xs text-muted-foreground">{t("hoaFinance.reserve.wealthReportNote")}</p>

			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold">{t("hoaFinance.reserve.ledgerTitle")}</h2>
			</div>

			<Card>
				<CardContent className="p-0">
					{rows.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
							<PiggyBank className="size-8" />
							<p>{t("hoaFinance.reserve.empty")}</p>
						</div>
					) : (
						<ReserveFundBookingsTable rows={rows} hoaId={hoaId} />
					)}
				</CardContent>
			</Card>
		</div>
	);
}