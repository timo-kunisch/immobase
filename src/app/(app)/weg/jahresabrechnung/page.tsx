import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";

import { listAnnualStatements, listHoasSortedByName } from "@/data/annual-statements";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AnnualStatementFormDialog } from "@/components/weg/annual-statement-form-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatDate } from "@/lib/format";
import { annualStatementStatusStyles } from "@/lib/hoa-annual-statement";
import { getT } from "@/lib/i18n/server";

import { deleteAnnualStatementAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function JahresabrechnungListPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;
	const t = await getT();

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaStatement.title")} description={t("hoaStatement.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaStatement.empty.noHoa")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	const statementList = listAnnualStatements(selectedHoa ? { hoaId: selectedHoa.id } : undefined);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("hoaStatement.title")}
				description={t("hoaStatement.description")}
				actions={selectedHoa ? <AnnualStatementFormDialog hoaId={selectedHoa.id} /> : undefined}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/jahresabrechnung" />

				<Card>
					<CardContent className="p-0">
						{statementList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaStatement.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										{!selectedHoa ? <TableHead>{t("hoaStatement.table.hoa")}</TableHead> : null}
										<TableHead>{t("hoaStatement.table.period")}</TableHead>
										<TableHead>{t("common.status")}</TableHead>
										<TableHead className="w-[140px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{statementList.map((statement) => (
										<TableRow key={statement.id} id={`annual-statement-${statement.id}`}>
											{!selectedHoa ? <TableCell className="text-muted-foreground">{statement.hoaName}</TableCell> : null}
											<TableCell className="font-medium">
												{formatDate(statement.periodFrom)} – {formatDate(statement.periodTo)}
											</TableCell>
											<TableCell>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${annualStatementStatusStyles[statement.status]}`}>
													{t(`hoaStatement.status.${statement.status}`)}
												</span>
											</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<Button variant="ghost" size="icon-sm" aria-label={t("common.details")} title={t("common.details")} asChild>
														<Link href={`/weg/jahresabrechnung/${statement.id}`}>
															<ChevronRight className="size-4" />
														</Link>
													</Button>
													{/* Finalisierte Abrechnungen sind ebenfalls löschbar - die Action räumt
													    erzeugte PDFs und Postversand-Protokolle mit weg
													    (deleteAnnualStatementWithArtifacts), deshalb eine eigene,
													    deutlich warnende Bestätigung. */}
													<ConfirmDeleteButton
														action={deleteAnnualStatementAction.bind(null, statement.id, statement.hoaId)}
														confirmMessage={
															statement.status === "DRAFT"
																? t("hoaStatement.confirm.delete")
																: t("hoaStatement.confirm.deleteFinalized")
														}
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
			</div>
		</div>
	);
}
