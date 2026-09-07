import { Scale } from "lucide-react";

import { listHoasWithProperty } from "@/data/hoas";
import { listCustomAllocationKeysWithWeights, listUnitsForHoa } from "@/data/hoa-allocation-keys";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CustomAllocationKeyFormDialog } from "@/components/weg/custom-allocation-key-form-dialog";
import { CustomAllocationWeightsDialog } from "@/components/weg/custom-allocation-weights-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";

import { deleteCustomAllocationKeyAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VerteilerschluesselPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;

	// WEGs für den Filter alphabetisch (bisher per SQL ORDER BY name, jetzt im
	// Anschluss an listHoasWithProperty() sortiert - Code-Unit-Vergleich
	// entspricht der SQLite-BINARY-Kollation).
	const hoaList = [...listHoasWithProperty()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title="Verteilerschlüssel" description="Frei definierte Verteilerschlüssel je WEG." />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	// Schlüssel + Einheiten werden nur für die ausgewählte WEG benötigt (ohne
	// Auswahl wird keine Tabelle gerendert).
	const customAllocationKeys = selectedHoa ? listCustomAllocationKeysWithWeights(selectedHoa.id) : [];
	const units = selectedHoa ? listUnitsForHoa(selectedHoa.id) : [];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title="Verteilerschlüssel"
				description="Frei definierte Verteilerschlüssel je WEG."
				actions={selectedHoa ? <CustomAllocationKeyFormDialog hoaId={selectedHoa.id} /> : undefined}
			/>

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/verteilerschluessel" />

				<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
					Neben den festen Verteilerschlüsseln (Miteigentumsanteile, Wohnfläche, Einheiten, Verbrauch, direkte Zuordnung) können hier zusätzliche, frei definierte Verteilerschlüssel
					angelegt werden (z. B. „Anzahl Stellplätze“). Diese stehen anschließend bei Kostenpositionen im Wirtschaftsplan und der Jahresabrechnung zur Auswahl.
				</div>

				{!selectedHoa ? (
					<p className="text-sm text-muted-foreground">Wählen Sie oben eine WEG aus, um Verteilerschlüssel anzulegen oder zu bearbeiten.</p>
				) : (
					<Card>
						<CardContent className="p-0">
							{customAllocationKeys.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
									<Scale className="size-8" />
									<p>Noch keine frei definierten Verteilerschlüssel angelegt.</p>
								</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Bezeichnung</TableHead>
											<TableHead>Notizen</TableHead>
											<TableHead className="w-[120px] text-right">Aktionen</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{customAllocationKeys.map((key) => (
											<TableRow key={key.id}>
												<TableCell className="font-medium">{key.label}</TableCell>
												<TableCell className="text-muted-foreground">{key.notes ?? "–"}</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<CustomAllocationWeightsDialog hoaId={selectedHoa.id} customAllocationKeyId={key.id} customAllocationKeyLabel={key.label} units={units} weights={key.weights} />
														<CustomAllocationKeyFormDialog hoaId={selectedHoa.id} customAllocationKey={key} />
														<ConfirmDeleteButton action={deleteCustomAllocationKeyAction.bind(null, key.id, selectedHoa.id)} confirmMessage={`Verteilerschlüssel "${key.label}" wirklich löschen?`} />
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
