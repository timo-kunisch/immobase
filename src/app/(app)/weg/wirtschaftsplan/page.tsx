import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";

import { listEconomicPlans, listHoasSortedByName } from "@/data/economic-plans";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EconomicPlanFormDialog } from "@/components/weg/economic-plan-form-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatDate } from "@/lib/format";
import { economicPlanStatusLabels, economicPlanStatusStyles } from "@/lib/hoa-economic-plan";

import { deleteEconomicPlanAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WirtschaftsplanListPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title="Wirtschaftspläne" description="Wirtschaftspläne je WEG und Geschäftsjahr." />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	const planList = listEconomicPlans(selectedHoa ? { hoaId: selectedHoa.id } : undefined);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Wirtschaftspläne" description="Wirtschaftspläne je WEG und Geschäftsjahr." actions={selectedHoa ? <EconomicPlanFormDialog hoaId={selectedHoa.id} /> : undefined} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/wirtschaftsplan" />

				<Card>
					<CardContent className="p-0">
						{planList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>Noch keine Wirtschaftspläne angelegt.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										{!selectedHoa ? <TableHead>WEG</TableHead> : null}
										<TableHead>Geschäftsjahr</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="w-[140px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{planList.map((plan) => (
										<TableRow key={plan.id} id={`economic-plan-${plan.id}`}>
											{!selectedHoa ? <TableCell className="text-muted-foreground">{plan.hoaName}</TableCell> : null}
											<TableCell className="font-medium">
												{formatDate(plan.fiscalYearFrom)} – {formatDate(plan.fiscalYearTo)}
											</TableCell>
											<TableCell>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${economicPlanStatusStyles[plan.status]}`}>
													{economicPlanStatusLabels[plan.status]}
												</span>
											</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<Button variant="ghost" size="icon-sm" aria-label="Details" title="Details" asChild>
														<Link href={`/weg/wirtschaftsplan/${plan.id}`}>
															<ChevronRight className="size-4" />
														</Link>
													</Button>
													{plan.status === "DRAFT" ? (
														<ConfirmDeleteButton action={deleteEconomicPlanAction.bind(null, plan.id, plan.hoaId)} confirmMessage="Diesen Wirtschaftsplan wirklich löschen?" />
													) : null}
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
