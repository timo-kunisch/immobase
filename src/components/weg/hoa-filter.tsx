"use client";

import { useRouter } from "next/navigation";

import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Hoa } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";

const ALL_VALUE = "all";

/**
 * Liegenschafts-Filter (analog BillingPropertyFilter),
 * aber für WEGs - ermöglicht die Auswahl einer WEG auf den nun flachen
 * Top-Level-Seiten unter /weg/* (Wirtschaftsplan, Jahresabrechnung,
 * Hausgeld, Rücklage, Versammlungen, Eigentumsverhaeltnisse,
 * Verteilerschluessel, Buchhaltung) - konsistent zum Muster der
 * Mietverwaltung (z. B. /einheiten?propertyId=).
 */
export function HoaFilter({ hoas, value, basePath }: { hoas: Hoa[]; value?: string; basePath: string }) {
	const router = useRouter();
	const { t } = useI18n();

	return (
		<SearchableSelect
			value={value ?? ALL_VALUE}
			onValueChange={(next) => {
				router.push(next === ALL_VALUE ? basePath : `${basePath}?hoaId=${next}`);
			}}
			options={[
				{ value: ALL_VALUE, label: t("hoa.filter.all") },
				...hoas.map((hoa) => ({ value: hoa.id, label: hoa.name })),
			]}
			placeholder={t("hoa.filter.placeholder")}
			className="w-full sm:w-64"
		/>
	);
}