import { Calculator } from "lucide-react";

import { listAnnualStatements, listHoasSortedByName } from "@/data/annual-statements";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { AnnualStatementFormDialog } from "@/components/weg/annual-statement-form-dialog";
import { AnnualStatementsTable } from "@/components/weg/annual-statements-table";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { getT } from "@/lib/i18n/server";

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
							<AnnualStatementsTable rows={statementList} showHoaColumn={!selectedHoa} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}