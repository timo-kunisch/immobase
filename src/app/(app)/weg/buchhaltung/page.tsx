import Link from "next/link";
import { ArrowLeftRight, Landmark, Wallet } from "lucide-react";

import { listAccountsWithStats } from "@/data/accounts";
import { countBankTransactions, listBankTransactionsPage } from "@/data/bank-transactions";
import { listOpenHousingChargesForProperty, listHoasSortedByName } from "@/data/housing-charges";
import type { BankTransactionStatus } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AccountFormDialog } from "@/components/buchhaltung/account-form-dialog";
import { BankTransactionFormDialog, EditBankTransactionDialog } from "@/components/buchhaltung/bank-transaction-form-dialog";
import { BankTransactionAllocateDialog } from "@/components/buchhaltung/bank-transaction-allocate-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatCurrency, formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { resolvePagination } from "@/lib/pagination";

import { deleteAccountAction, deleteBankTransactionAction } from "@/app/(app)/buchhaltung/actions";

export const dynamic = "force-dynamic";

/** Gültige Status-Werte für den Filter (Absicherung gegen beliebige Query-Strings). */
const bankTransactionStatuses: BankTransactionStatus[] = ["OPEN", "PARTIAL", "RECONCILED"];

const bankTransactionStatusStyles: Record<BankTransactionStatus, string> = {
	OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	RECONCILED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

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
export default async function WegBuchhaltungPage({
	searchParams,
}: {
	searchParams: Promise<{ hoaId?: string; status?: string; page?: string }>;
}) {
	const t = await getT();
	const { hoaId, status: statusParam, page: pageParam } = await searchParams;

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

	// Status-Filter nur akzeptieren, wenn es ein gültiger Status ist.
	const status = bankTransactionStatuses.find((value) => value === statusParam);

	// Ohne WEG-Auswahl: Banktransaktionen aller WEGs (der Liegenschaften mit
	// WEG), mit Auswahl: nur die der gewählten WEG.
	const hoaPropertyIds = hoaList.map((hoa) => hoa.propertyId);
	const bankTransactionFilter = selectedHoa ? { propertyId: selectedHoa.propertyId, status } : { propertyIds: hoaPropertyIds, status };
	const pagination = resolvePagination(pageParam, countBankTransactions(bankTransactionFilter));
	const bankTransactionList = listBankTransactionsPage(bankTransactionFilter, pagination);

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

						<div className="flex flex-wrap items-end justify-between gap-2">
							{/* Status-Filter als schlichtes GET-Formular (Server-Navigation,
							    page wird dadurch automatisch zurückgesetzt). */}
							<form method="get" className="flex flex-wrap items-end gap-2">
								{hoaId ? <input type="hidden" name="hoaId" value={hoaId} /> : null}
								<div className="flex flex-col gap-1">
									<label htmlFor="status" className="text-xs text-muted-foreground">
										{t("common.status")}
									</label>
									<select id="status" name="status" defaultValue={status ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm">
										<option value="">{t("banking.filter.allStatuses")}</option>
										{bankTransactionStatuses.map((value) => (
											<option key={value} value={value}>
												{t(`banking.status.${value}`)}
											</option>
										))}
									</select>
								</div>
								<Button type="submit" variant="outline" size="sm">
									{t("common.filter")}
								</Button>
								{status ? (
									<Button asChild variant="ghost" size="sm">
										<Link href={hoaId ? `/weg/buchhaltung?hoaId=${hoaId}` : "/weg/buchhaltung"}>{t("banking.filter.reset")}</Link>
									</Button>
								) : null}
							</form>
							{/* Banktransaktionen werden immer auf dem Konto EINER
							    WEG (Liegenschaft) erfasst - ohne Auswahl kein Anlegen. */}
							{selectedHoa ? <BankTransactionFormDialog propertyId={selectedHoa.propertyId} /> : null}
						</div>

						<Card>
							<CardContent className="p-0">
								{bankTransactionList.length === 0 ? (
									<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
										<Landmark className="size-8" />
										<p>{status ? t("banking.empty.transactionsFiltered") : t("banking.empty.transactions")}</p>
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>{t("banking.table.bookingDate")}</TableHead>
												<TableHead>{t("banking.table.description")}</TableHead>
												<TableHead className="text-right">{t("common.amount")}</TableHead>
												<TableHead>{t("banking.table.allocatedTo")}</TableHead>
												<TableHead>{t("common.status")}</TableHead>
												<TableHead className="w-[120px] text-right">{t("common.actions")}</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{bankTransactionList.map((bankTransaction) => {
												const amountEuros = Number(bankTransaction.amount);
												return (
													<TableRow key={bankTransaction.id}>
														<TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(bankTransaction.bookingDate)}</TableCell>
														<TableCell className="font-medium">
															{bankTransaction.description}
															{bankTransaction.partner ? <span className="block text-xs text-muted-foreground">{bankTransaction.partner}</span> : null}
														</TableCell>
														<TableCell className={`text-right font-medium ${amountEuros < 0 ? "text-red-600" : "text-emerald-600"}`}>
															{formatCurrency(bankTransaction.amount)}
														</TableCell>
														<TableCell className="text-muted-foreground">
															{bankTransaction.allocations.length === 0 ? (
																"–"
															) : (
																<span className="block space-y-0.5">
																	{bankTransaction.allocations.map((allocation) => (
																		<span key={allocation.id} className="block text-xs">
																			{formatCurrency(allocation.amount)} → {allocation.account?.label ?? allocation.transactionLabel ?? allocation.housingChargeLabel ?? "–"}
																		</span>
																	))}
																</span>
															)}
														</TableCell>
														<TableCell>
															<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bankTransactionStatusStyles[bankTransaction.status]}`}>
																{t(`banking.status.${bankTransaction.status}`)}
															</span>
														</TableCell>
														<TableCell>
															<div className="flex items-center justify-end gap-1">
																<BankTransactionAllocateDialog
																	bankTransaction={{
																		id: bankTransaction.id,
																		description: bankTransaction.description,
																		amount: bankTransaction.amount,
																		bookingDate: bankTransaction.bookingDate,
																		allocations: bankTransaction.allocations.map((allocation) => ({
																			accountId: allocation.accountId,
																			transactionId: allocation.transactionId,
																			housingChargeId: allocation.housingChargeId,
																			amount: allocation.amount,
																		})),
																	}}
																	accounts={accounts}
																	openTransactions={[]}
																	housingCharges={openHousingChargeOptions}
																/>
																<EditBankTransactionDialog
																	transaction={{
																		id: bankTransaction.id,
																		bookingDate: bankTransaction.bookingDate,
																		amount: bankTransaction.amount,
																		description: bankTransaction.description,
																		partner: bankTransaction.partner,
																		notes: bankTransaction.notes,
																	}}
																	propertyId={bankTransaction.propertyId}
																/>
																<ConfirmDeleteButton
																	action={deleteBankTransactionAction.bind(null, bankTransaction.id)}
																	confirmMessage={t("banking.confirm.deleteTransaction", { description: bankTransaction.description })}
																/>
															</div>
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								)}
							</CardContent>
						</Card>

						<PaginationBar basePath="/weg/buchhaltung" pagination={pagination} params={{ hoaId, status }} />
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
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>{t("banking.table.account")}</TableHead>
													<TableHead>{t("common.notes")}</TableHead>
													<TableHead className="text-right">{t("banking.table.allocatedAmount")}</TableHead>
													<TableHead className="text-right">{t("banking.table.bookings")}</TableHead>
													<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{accounts.map((account) => {
													const allocatedEuros = Number(account.allocatedAmount);
													return (
														<TableRow key={account.id}>
															<TableCell className="font-medium">{account.label}</TableCell>
															<TableCell className="text-muted-foreground">{account.notes ?? "–"}</TableCell>
															<TableCell className={`text-right ${allocatedEuros < 0 ? "text-red-600" : "text-emerald-600"}`}>
																{formatCurrency(account.allocatedAmount)}
															</TableCell>
															<TableCell className="text-right text-muted-foreground">{account.bookingCount}</TableCell>
															<TableCell>
																<div className="flex items-center justify-end gap-1">
																	<AccountFormDialog propertyId={selectedHoa.propertyId} account={account} />
																	<ConfirmDeleteButton
																		action={deleteAccountAction.bind(null, account.id)}
																		confirmMessage={t("banking.confirm.deleteAccount", { label: account.label })}
																	/>
																</div>
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
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