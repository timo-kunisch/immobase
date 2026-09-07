"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Property } from "@/data/types";

const ALL_VALUE = "all";

export function UnitPropertyFilter({ properties, value }: { properties: Property[]; value?: string }) {
	const router = useRouter();

	return (
		<Select
			value={value ?? ALL_VALUE}
			onValueChange={(next) => {
				router.push(next === ALL_VALUE ? "/einheiten" : `/einheiten?propertyId=${next}`);
			}}
		>
			<SelectTrigger className="w-full sm:w-64">
				<SelectValue placeholder="Alle Liegenschaften" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_VALUE}>Alle Liegenschaften</SelectItem>
				{properties.map((property) => (
					<SelectItem key={property.id} value={property.id}>
						{property.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
