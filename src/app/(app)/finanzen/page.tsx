import Link from "next/link";
import { AlertTriangle, PiggyBank, Wallet } from "lucide-react";

import { getLeaseWithDetails, listLeasesWithDetails } from "@/data/leases";
import { listOpenTransactionArrearAmounts, listTransactions } from "@/data/transactions";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepositsTable } from "@/components/finanzen/deposits-table";
import { TransactionFormDialog } from "@/components/finanzen/transaction-form-dialog";
import { GenerateDueTransactionsDialog } from "@/components/finanzen/generate-due-transactions-dialog";
import { TransactionsTable } from "@/components/finanzen/transactions-table";
import { formatCurrency } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function FinanzenPage({ searchParams }: { searchParams: Promise<{ leaseId?: string }> }) {
	const t = await getT();
	const { leaseId } = await searchParams;

	// Vertrags-Filter aus Cross-Modul-Links (?leaseId=) bleibt serverseitig
	// als Vorfilter wirksam (Liste + Formular-Dialoge).
	const leaseList = listLeasesWithDetails(leaseId ? { leaseId } : undefined);
	const filteredLease = leaseId ? getLeaseWithDetails(leaseId) : null;

	// Vollständige Liste (Sortierung/Filterung/Pagination übernimmt die
	// Client-Datentabelle inkl. Status-Select-Filter je Spalte).
	const transactionList = listTransactions(leaseId ? { leaseId } : undefined);

	const filterLabel = filteredLease
		? `${filteredLease.tenant.firstName} ${filteredLease.tenant.lastName} · ${filteredLease.unit.property.name} – ${filteredLease.unit.label}`
		: null;

	// Rückstände über ALLE Zahlungen (unabhängig vom Filter-Status).
	const now = new Date();
	const arrears = listOpenTransactionArrearAmounts(now, { leaseId }).reduce((sum, amount) => sum + Number(amount), 0);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("finances.title")} description={t("finances.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{filterLabel ? (
					<p className="text-sm text-muted-foreground">
						{t("finances.filter.filteredBy")} <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
						<Link href="/finanzen" className="text-primary hover:underline">
							{t("common.resetFilters")}
						</Link>
					</p>
				) : null}
				<Tabs defaultValue="mieteingaenge">
					<TabsList>
						<TabsTrigger value="mieteingaenge">
							<Wallet /> {t("finances.tabs.transactions")}
						</TabsTrigger>
						<TabsTrigger value="kautionen">
							<PiggyBank /> {t("finances.tabs.deposits")}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="mieteingaenge" className="space-y-4">
						{arrears > 0 ? (
							<Card className="border-red-200 dark:border-red-900">
								<CardContent className="flex items-center gap-3 py-4">
									<AlertTriangle className="size-5 text-red-600" />
									<p className="text-sm">
										<span className="font-semibold">{formatCurrency(arrears)}</span> {t("finances.stats.arrears")}
									</p>
								</CardContent>
							</Card>
						) : null}

						<div className="flex flex-wrap items-center justify-end gap-2">
							<GenerateDueTransactionsDialog />
							<TransactionFormDialog leases={leaseList} />
						</div>

						<Card>
							<CardContent className="p-0">
								{transactionList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<Wallet className="size-8" />
										<p>{t("finances.empty.transactions")}</p>
									</div>
								) : (
									<TransactionsTable rows={transactionList} leases={leaseList} />
								)}
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="kautionen" className="space-y-4">
						<Card>
							<CardContent className="p-0">
							{leaseList.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
									<PiggyBank className="size-8" />
									<p>{t("finances.empty.leases")}</p>
								</div>
							) : (
								<DepositsTable rows={leaseList} />
							)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
