"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import type { Property } from "@/data/types";

const ALL_VALUE = "all";

export function UnitPropertyFilter({ properties, value }: { properties: Property[]; value?: string }) {
	const { t } = useI18n();
	const router = useRouter();

	return (
		<Select
			value={value ?? ALL_VALUE}
			onValueChange={(next) => {
				router.push(next === ALL_VALUE ? "/einheiten" : `/einheiten?propertyId=${next}`);
			}}
		>
		<SelectTrigger className="w-full sm:w-64">
			<SelectValue placeholder={t("units.filter.allProperties")} />
		</SelectTrigger>
		<SelectContent>
			<SelectItem value={ALL_VALUE}>{t("units.filter.allProperties")}</SelectItem>
				{properties.map((property) => (
					<SelectItem key={property.id} value={property.id}>
						{property.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
