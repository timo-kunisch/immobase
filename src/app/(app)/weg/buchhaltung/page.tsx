import { ArrowLeftRight, Landmark, Wallet } from "lucide-react";

import { listAccountsWithStats } from "@/data/accounts";
import { listBankTransactions } from "@/data/bank-transactions";
import { listOpenHousingChargesForProperty, listHoasSortedByName } from "@/data/housing-charges";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountFormDialog } from "@/components/buchhaltung/account-form-dialog";
import { AccountsTable } from "@/components/buchhaltung/accounts-table";
import { BankTransactionFormDialog } from "@/components/buchhaltung/bank-transaction-form-dialog";
import { HoaBankTransactionsTable } from "@/components/weg/hoa-bank-transactions-table";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * WEG-Buchhaltung: Reiter "Banktransaktionen" und "Konten" der WEGs -
 * Sicht auf die geteilte, liegenschaftsbezogene Buchhaltung (eine WEG hängt
 * 1:1 an einer Liegenschaft, das Bankkonto der Liegenschaft IST das
 * WEG-Konto). Als Buchungsziel stehen neben Konten die offenen HAUSGELD-
 * Sollstellungen der WEG bereit (Zahlungseingänge von Eigentümern) -
 * vollständig zugeordnete Hausgelder gelten automatisch als bezahlt und
 * fließen so als tatsächlich geleistete Vorauszahlungen in die
 * Jahresabrechnung ein. Buchungen gegen Miet-Sollstellungen bleiben der
 * Mietverwaltung (/buchhaltung) vorbehalten - die Kreise trennen sich.
 */
export default async function WegBuchhaltungPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const t = await getT();
	const { hoaId } = await searchParams;

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaFinance.banking.title")} description={t("hoaFinance.banking.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaStatement.empty.noHoa")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((hoa) => hoa.id === hoaId) : undefined;

	// Ohne WEG-Auswahl: Banktransaktionen aller WEGs (der Liegenschaften mit
	// WEG), mit Auswahl: nur die der gewählten WEG. Vollständige Liste
	// (Sortierung/Filterung/Pagination inkl. Status-Select-Filter übernimmt
	// die Client-Datentabelle).
	const hoaPropertyIds = hoaList.map((hoa) => hoa.propertyId);
	const bankTransactionList = selectedHoa
		? listBankTransactions({ propertyId: selectedHoa.propertyId })
		: listBankTransactions({ propertyIds: hoaPropertyIds });

	const accounts = selectedHoa ? listAccountsWithStats(selectedHoa.propertyId) : [];
	// Offene Hausgeld-Sollstellungen der Liegenschaft für den Zuordnen-Dialog
	// (Banktransaktionen werden gegen sie gebucht -> als bezahlt markiert).
	const openHousingCharges = selectedHoa ? listOpenHousingChargesForProperty(selectedHoa.propertyId) : [];
	const openHousingChargeOptions = openHousingCharges.map((charge) => ({
		id: charge.id,
		label: `${charge.purpose ?? "Hausgeld"} · ${charge.owner.isCompany ? charge.owner.companyName ?? `${charge.owner.firstName} ${charge.owner.lastName}` : `${charge.owner.firstName} ${charge.owner.lastName}`} (${charge.unit.label})`,
		amount: charge.amount,
		dueDate: charge.dueDate,
	}));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaFinance.banking.title")} description={t("hoaFinance.banking.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/buchhaltung" />

				<Tabs defaultValue="banktransaktionen">
					<TabsList>
						<TabsTrigger value="banktransaktionen">
							<Landmark /> {t("banking.tabs.bankTransactions")}
						</TabsTrigger>
						<TabsTrigger value="konten">
							<Wallet /> {t("banking.tabs.accounts")}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="banktransaktionen" className="space-y-4">
						<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("hoaFinance.banking.info")}</div>

						{/* Banktransaktionen werden immer auf dem Konto EINER
						    WEG (Liegenschaft) erfasst - ohne Auswahl kein Anlegen. */}
						{selectedHoa ? (
							<div className="flex flex-wrap items-center justify-end gap-2">
								<BankTransactionFormDialog propertyId={selectedHoa.propertyId} />
							</div>
						) : null}

						<Card>
							<CardContent className="p-0">
								{bankTransactionList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<Landmark className="size-8" />
										<p>{t("banking.empty.transactions")}</p>
									</div>
								) : (
									<HoaBankTransactionsTable rows={bankTransactionList} accounts={accounts} openHousingCharges={openHousingChargeOptions} />
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="konten" className="space-y-4">
						{!selectedHoa ? (
							<p className="text-sm text-muted-foreground">{t("hoaFinance.banking.selectHoa")}</p>
						) : (
							<Card>
								<CardContent className="p-0">
									<div className="flex items-center justify-between border-b px-4 py-3">
										<span className="text-sm text-muted-foreground">{t("banking.accounts.management")}</span>
										<AccountFormDialog propertyId={selectedHoa.propertyId} />
									</div>
									{accounts.length === 0 ? (
										<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
											<ArrowLeftRight className="size-8" />
											<p>{t("banking.empty.accounts")}</p>
										</div>
									) : (
										<AccountsTable rows={accounts} propertyId={selectedHoa.propertyId} />
									)}
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
