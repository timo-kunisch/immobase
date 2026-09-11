import { ArrowLeftRight, Landmark, Wallet } from "lucide-react";

import { listAccountsWithStats } from "@/data/accounts";
import { listBankTransactions } from "@/data/bank-transactions";
import { listOpenTransactionsForProperty } from "@/data/transactions";
import { listProperties } from "@/data/properties";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsTable } from "@/components/buchhaltung/accounts-table";
import { AccountFormDialog } from "@/components/buchhaltung/account-form-dialog";
import { BankTransactionFormDialog } from "@/components/buchhaltung/bank-transaction-form-dialog";
import { BankTransactionsTable } from "@/components/buchhaltung/bank-transactions-table";
import { BuchhaltungPropertyFilter } from "@/components/buchhaltung/buchhaltung-property-filter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function BuchhaltungPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
	const t = await getT();
	const { propertyId } = await searchParams;

	const propertyList = listProperties();
	const selectedProperty = propertyId ? propertyList.find((property) => property.id === propertyId) : undefined;

	// Vollständige Liste der Liegenschaft (Sortierung/Filterung/Pagination
	// übernimmt die Client-Datentabelle inkl. Status-Select-Filter je Spalte).
	const bankTransactionList = selectedProperty ? listBankTransactions({ propertyId }) : [];

	const accounts = selectedProperty ? listAccountsWithStats(selectedProperty.id) : [];
	// Offene Sollstellungen der Liegenschaft für den Zuordnen-Dialog
	// (Banktransaktionen werden gegen sie gebucht -> als bezahlt markiert).
	const openTransactions = selectedProperty ? listOpenTransactionsForProperty(selectedProperty.id) : [];
	const openTransactionOptions = openTransactions.map((transaction) => ({
		id: transaction.id,
		label: `${transaction.purpose ?? "Sollstellung"} · ${transaction.lease.tenant.firstName} ${transaction.lease.tenant.lastName}`,
		amount: transaction.amount,
		dueDate: transaction.dueDate,
	}));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("banking.title")} description={t("banking.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{propertyList.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("banking.empty.noProperties")}</p>
				) : (
					<BuchhaltungPropertyFilter properties={propertyList} value={propertyId} />
				)}

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
						<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("banking.info")}</div>

						{/* Banktransaktionen werden immer auf dem Konto EINER
						    Liegenschaft erfasst - ohne Auswahl kein Anlegen. */}
						{selectedProperty ? (
							<div className="flex flex-wrap items-center justify-end gap-2">
								<BankTransactionFormDialog propertyId={selectedProperty.id} />
							</div>
						) : null}

						<Card>
							<CardContent className="p-0">
								{!propertyId ? (
									<p className="px-4 py-16 text-center text-sm text-muted-foreground">{t("banking.empty.selectProperty")}</p>
								) : bankTransactionList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<Landmark className="size-8" />
										<p>{t("banking.empty.transactions")}</p>
									</div>
								) : (
									<BankTransactionsTable
										rows={bankTransactionList}
										accounts={accounts}
										openTransactions={openTransactionOptions}
									/>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="konten" className="space-y-4">
						{!propertyId ? (
							<p className="text-sm text-muted-foreground">{t("banking.empty.selectProperty")}</p>
						) : (
							<Card>
								<CardContent className="p-0">
									<div className="flex items-center justify-between border-b px-4 py-3">
										<span className="text-sm text-muted-foreground">{t("banking.accounts.management")}</span>
										<AccountFormDialog propertyId={propertyId} />
									</div>
									{accounts.length === 0 ? (
										<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
											<ArrowLeftRight className="size-8" />
											<p>{t("banking.empty.accounts")}</p>
										</div>
									) : (
										<AccountsTable rows={accounts} propertyId={propertyId} />
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
