import Link from "next/link";
import { Gavel } from "lucide-react";

import { countOwnerResolutions, listHoas, listOwnerResolutionsPage } from "@/data/meetings";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { resolvePagination } from "@/lib/pagination";
import { isContestationDeadlinePassed, resolutionVotingResultStyles } from "@/lib/hoa-meetings";

export const dynamic = "force-dynamic";

/**
 * Vollständige, chronologisch fortlaufend nummerierte Beschluss-Sammlung
 * (§ 24 Abs. 6 WEG) über ALLE Versammlungen einer WEG hinweg - anders als
 * die Beschluss-Liste innerhalb einer einzelnen Versammlungs-Detailseite
 * (/weg/versammlungen/[meetingId]) ist dies eine reine Lesansicht ohne
 * Bearbeiten/Löschen (Bearbeitung erfolgt ausschließlich über die
 * jeweilige Versammlung, siehe Verlinkung je Zeile). Flache Top-Level-
 * Seite mit optionalem hoaId-Filter (siehe HoaFilter), analog zu den
 * übrigen WEG-Funktionen.
 */
export default async function BeschluesseUebersichtPage({ searchParams }: { searchParams: Promise<{ hoaId?: string; page?: string }> }) {
	const t = await getT();
	const { hoaId, page: pageParam } = await searchParams;

	const votingResultLabels: Record<string, string> = {
		ACCEPTED: t("hoaMeetings.votingResult.ACCEPTED"),
		REJECTED: t("hoaMeetings.votingResult.REJECTED"),
	};

	const hoaList = listHoas();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaMeetings.collection.title")} description={t("hoaMeetings.collection.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaMeetings.noHoas")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	const resolutionFilter = selectedHoa ? { hoaId: selectedHoa.id } : undefined;
	// Paginierte Beschluss-Sammlung (wächst über die Jahre, eine Seite = 50 Einträge).
	const resolutionPagination = resolvePagination(pageParam, countOwnerResolutions(resolutionFilter));
	const resolutionList = listOwnerResolutionsPage(resolutionFilter, resolutionPagination);

	const now = new Date();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaMeetings.collection.title")} description={t("hoaMeetings.collection.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/beschluesse" />

				<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("hoaMeetings.collection.info")}</div>

				<Card>
					<CardContent className="p-0">
						{resolutionList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Gavel className="size-8" />
								<p>{t("hoaMeetings.collection.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[60px]">{t("hoaMeetings.collection.table.number")}</TableHead>
										{!selectedHoa ? <TableHead>{t("hoaMeetings.collection.table.hoa")}</TableHead> : null}
										<TableHead>{t("hoaMeetings.collection.table.title")}</TableHead>
										<TableHead>{t("hoaMeetings.collection.table.meeting")}</TableHead>
										<TableHead>{t("common.date")}</TableHead>
										<TableHead>{t("hoaMeetings.collection.table.result")}</TableHead>
										<TableHead>{t("hoaMeetings.collection.table.contestableUntil")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{resolutionList.map((resolution) => {
										const deadlinePassed = resolution.contestedUntil ? isContestationDeadlinePassed(new Date(resolution.contestedUntil), now) : true;
										return (
											<TableRow key={resolution.id} id={`resolution-collection-${resolution.sequenceNumber}`}>
												<TableCell className="font-medium">{resolution.sequenceNumber}</TableCell>
												{!selectedHoa ? <TableCell className="text-muted-foreground">{resolution.hoaName}</TableCell> : null}
												<TableCell>
													<Link href={`/weg/versammlungen/${resolution.meetingId}#resolution-${resolution.id}`} className="hover:underline">
														{resolution.title}
													</Link>
												</TableCell>
												<TableCell className="text-muted-foreground">{resolution.meetingTitle}</TableCell>
												<TableCell className="text-muted-foreground">{formatDate(resolution.resolvedAt)}</TableCell>
											<TableCell>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${resolutionVotingResultStyles[resolution.votingResult]}`}>
													{votingResultLabels[resolution.votingResult]}
												</span>
											</TableCell>
											<TableCell>
												{resolution.contestedUntil ? (
													<span className="flex items-center gap-2 text-muted-foreground">
														{formatDate(resolution.contestedUntil)}
														{!deadlinePassed ? (
															<Badge variant="outline" className="text-amber-700 dark:text-amber-400">
																{t("hoaMeetings.collection.contestableBadge")}
															</Badge>
														) : null}
													</span>
												) : (
													"–"
												)}
											</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<PaginationBar basePath="/weg/beschluesse" pagination={resolutionPagination} params={{ hoaId }} />
			</div>
		</div>
	);
}
