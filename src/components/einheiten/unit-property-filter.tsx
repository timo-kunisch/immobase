"use client";

import { useRouter } from "next/navigation";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { useI18n } from "@/lib/i18n/provider";
import type { Property } from "@/data/types";

const ALL_VALUE = "all";

export function UnitPropertyFilter({ properties, value }: { properties: Property[]; value?: string }) {
	const { t } = useI18n();
	const router = useRouter();

	return (
		<SearchableSelect
			value={value ?? ALL_VALUE}
			onValueChange={(next) => {
				router.push(next === ALL_VALUE ? "/einheiten" : `/einheiten?propertyId=${next}`);
			}}
			options={[
				{ value: ALL_VALUE, label: t("units.filter.allProperties") },
				...properties.map((property) => ({ value: property.id, label: property.name })),
			]}
			placeholder={t("units.filter.allProperties")}
			className="w-full sm:w-64"
		/>
	);
}