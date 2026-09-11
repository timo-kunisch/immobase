"use client";

import { useRouter } from "next/navigation";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { useI18n } from "@/lib/i18n/provider";
import type { Property } from "@/data/types";

const ALL_VALUE = "all";

/** Liegenschafts-Filter der Buchhaltung (Konto je Liegenschaft, ?propertyId=). */
export function BuchhaltungPropertyFilter({ properties, value }: { properties: Property[]; value?: string }) {
	const { t } = useI18n();
	const router = useRouter();

	return (
		<SearchableSelect
			value={value ?? ALL_VALUE}
			onValueChange={(next) => {
				router.push(next === ALL_VALUE ? "/buchhaltung" : `/buchhaltung?propertyId=${next}`);
			}}
			options={[
				{ value: ALL_VALUE, label: t("banking.filter.allProperties") },
				...properties.map((property) => ({ value: property.id, label: property.name })),
			]}
			placeholder={t("banking.filter.allProperties")}
			className="w-full sm:w-64"
		/>
	);
}