import Link from "next/link";
import { AlertTriangle, PiggyBank, Wallet } from "lucide-react";

import { getLeaseWithDetails, listLeasesWithDetails } from "@/data/leases";
import { countTransactions, listOpenTransactionArrearAmounts, listTransactionsPage } from "@/data/transactions";
import type { TransactionStatus } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DepositFormDialog } from "@/components/finanzen/deposit-form-dialog";
import { TransactionFormDialog } from "@/components/finanzen/transaction-form-dialog";
import { GenerateDueTransactionsDialog } from "@/components/finanzen/generate-due-transactions-dialog";
import { MarkPaidButton } from "@/components/finanzen/mark-paid-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolvePagination } from "@/lib/pagination";

import { deleteTransactionAction } from "./actions";

export const dynamic = "force-dynamic";

const depositStatusLabels: Record<string, string> = {
	PENDING: "Ausstehend",
	RECEIVED: "Hinterlegt",
	PARTIALLY_REFUNDED: "Teilweise zurückgezahlt",
	REFUNDED: "Vollständig zurückgezahlt",
};

const depositStatusStyles: Record<string, string> = {
	PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	PARTIALLY_REFUNDED: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	REFUNDED: "bg-muted text-muted-foreground",
};

const transactionStatusLabels: Record<TransactionStatus, string> = {
	OPEN: "Fällig",
	PAID: "Bezahlt",
	OVERDUE: "Überfällig",
	CANCELLED: "Storniert",
};

/** Gültige Status-Werte für den Filter (Absicherung gegen beliebige Query-Strings). */
const transactionStatuses = Object.keys(transactionStatusLabels) as TransactionStatus[];

const transactionStatusStyles: Record<string, string> = {
	OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	OVERDUE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	CANCELLED: "bg-muted text-muted-foreground",
};

export default async function FinanzenPage({ searchParams }: { searchParams: Promise<{ leaseId?: string; status?: string; page?: string }> }) {
	const { leaseId, status: statusParam, page: pageParam } = await searchParams;

	// Status-Filter nur akzeptieren, wenn es ein gültiger Zahlungsstatus ist.
	const status = transactionStatuses.find((value) => value === statusParam);

	const leaseList = listLeasesWithDetails({ leaseId });
	const filteredLease = leaseId ? getLeaseWithDetails(leaseId) : null;

	// Paginierte Mieteingangs-Liste (wächst unbegrenzt, eine Seite = 50 Einträge).
	const transactionFilter = { leaseId, status };
	const transactionPagination = resolvePagination(pageParam, countTransactions(transactionFilter));
	const transactionList = listTransactionsPage(transactionFilter, transactionPagination);

	const filterLabel = filteredLease ? `${filteredLease.tenant.firstName} ${filteredLease.tenant.lastName} · ${filteredLease.unit.property.name} – ${filteredLease.unit.label}` : null;

	// Rückstände über ALLE Zahlungen (unabhängig von der angezeigten Seite).
	const now = new Date();
	const arrears = listOpenTransactionArrearAmounts(now, { leaseId }).reduce((sum, amount) => sum + Number(amount), 0);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Finanzen" description="Kautionskonten und Mieteingänge." />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{filterLabel ? (
					<p className="text-sm text-muted-foreground">
						Gefiltert nach: <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
						<Link href="/finanzen" className="text-primary hover:underline">
							Filter zurücksetzen
						</Link>
					</p>
				) : null}
				<Tabs defaultValue="mieteingaenge">
					<TabsList>
						<TabsTrigger value="mieteingaenge">
							<Wallet /> Mieteingänge
						</TabsTrigger>
						<TabsTrigger value="kautionen">
							<PiggyBank /> Kautionskonten
						</TabsTrigger>
					</TabsList>

					<TabsContent value="mieteingaenge" className="space-y-4">
						{arrears > 0 ? (
							<Card className="border-red-200 dark:border-red-900">
								<CardContent className="flex items-center gap-3 py-4">
									<AlertTriangle className="size-5 text-red-600" />
									<p className="text-sm">
										<span className="font-semibold">{formatCurrency(arrears)}</span> an Mietrückständen (fällige/überfällige Zahlungen).
									</p>
								</CardContent>
							</Card>
						) : null}

						<div className="flex flex-wrap items-end justify-between gap-2">
							{/* Status-Filter als schlichtes GET-Formular (Server-Navigation, kein
							    Client-State nötig; page wird dadurch automatisch zurückgesetzt).
							    Ein gesetzter Vertrags-Filter (leaseId) bleibt per hidden input erhalten. */}
							<form method="get" className="flex flex-wrap items-end gap-2">
								{leaseId ? <input type="hidden" name="leaseId" value={leaseId} /> : null}
								<div className="flex flex-col gap-1">
									<label htmlFor="status" className="text-xs text-muted-foreground">
										Status
									</label>
									<select id="status" name="status" defaultValue={status ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm">
										<option value="">Alle Status</option>
										{transactionStatuses.map((value) => (
											<option key={value} value={value}>
												{transactionStatusLabels[value]}
											</option>
										))}
									</select>
								</div>
								<Button type="submit" variant="outline" size="sm">
									Filtern
								</Button>
								{status ? (
									<Button asChild variant="ghost" size="sm">
										<Link href={leaseId ? `/finanzen?leaseId=${leaseId}` : "/finanzen"}>Zurücksetzen</Link>
									</Button>
								) : null}
							</form>
							<div className="flex flex-wrap gap-2">
								<GenerateDueTransactionsDialog />
								<TransactionFormDialog leases={leaseList} />
							</div>
						</div>

						<Card>
							<CardContent className="p-0">
								{transactionList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<Wallet className="size-8" />
										<p>{status ? "Keine Zahlungen für den gewählten Status." : "Noch keine Zahlungen erfasst."}</p>
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Mieter / Einheit</TableHead>
												<TableHead>Verwendungszweck</TableHead>
												<TableHead>Fällig am</TableHead>
												<TableHead className="text-right">Betrag</TableHead>
												<TableHead>Status</TableHead>
												<TableHead className="w-[120px] text-right">Aktionen</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{transactionList.map((transaction) => (
												<TableRow key={transaction.id}>
													<TableCell className="font-medium">
														<Link href={`/mieter#tenant-${transaction.lease.tenantId}`} className="hover:underline">
															{transaction.lease.tenant.firstName} {transaction.lease.tenant.lastName}
														</Link>
														<Link href={`/einheiten#unit-${transaction.lease.unitId}`} className="block text-xs text-muted-foreground hover:underline">
															{transaction.lease.unit.property.name} – {transaction.lease.unit.label}
														</Link>
													</TableCell>
													<TableCell className="text-muted-foreground">{transaction.purpose ?? "–"}</TableCell>
													<TableCell className="text-muted-foreground">{formatDate(transaction.dueDate)}</TableCell>
													<TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
													<TableCell>
														<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${transactionStatusStyles[transaction.status]}`}>
															{transactionStatusLabels[transaction.status]}
														</span>
													</TableCell>
													<TableCell>
														<div className="flex items-center justify-end gap-1">
															{transaction.status !== "PAID" ? <MarkPaidButton transactionId={transaction.id} /> : null}
															<TransactionFormDialog transaction={transaction} leases={leaseList} />
															<ConfirmDeleteButton action={deleteTransactionAction.bind(null, transaction.id)} confirmMessage="Diese Zahlung wirklich löschen?" />
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>

						<PaginationBar basePath="/finanzen" pagination={transactionPagination} params={{ leaseId, status }} />
					</TabsContent>

					<TabsContent value="kautionen" className="space-y-4">
						<Card>
							<CardContent className="p-0">
								{leaseList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<PiggyBank className="size-8" />
										<p>Noch keine Mietverträge vorhanden.</p>
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Mieter / Einheit</TableHead>
												<TableHead className="text-right">Kaution (Vertrag)</TableHead>
												<TableHead className="text-right">Betrag (Konto)</TableHead>
												<TableHead>Status</TableHead>
												<TableHead className="w-[100px] text-right">Aktionen</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{leaseList.map((lease) => (
												<TableRow key={lease.id}>
													<TableCell className="font-medium">
														<Link href={`/mieter#tenant-${lease.tenantId}`} className="hover:underline">
															{lease.tenant.firstName} {lease.tenant.lastName}
														</Link>
														<Link href={`/einheiten#unit-${lease.unitId}`} className="block text-xs text-muted-foreground hover:underline">
															{lease.unit.property.name} – {lease.unit.label}
														</Link>
													</TableCell>
													<TableCell className="text-right text-muted-foreground">{formatCurrency(lease.deposit)}</TableCell>
													<TableCell className="text-right">{lease.depositAccount ? formatCurrency(lease.depositAccount.amount) : "–"}</TableCell>
													<TableCell>
														{lease.depositAccount ? (
															<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${depositStatusStyles[lease.depositAccount.status]}`}>
																{depositStatusLabels[lease.depositAccount.status]}
															</span>
														) : (
															<span className="text-xs text-muted-foreground">Nicht erfasst</span>
														)}
													</TableCell>
													<TableCell>
														<div className="flex items-center justify-end gap-1">
															<DepositFormDialog
																leaseId={lease.id}
																leaseLabel={`${lease.tenant.firstName} ${lease.tenant.lastName} · ${lease.unit.property.name} – ${lease.unit.label}`}
																deposit={lease.depositAccount ?? undefined}
																suggestedAmount={lease.deposit ?? undefined}
															/>
														</div>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
