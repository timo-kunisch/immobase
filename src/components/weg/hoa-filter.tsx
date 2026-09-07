"use client";

import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Hoa } from "@/data/types";

const ALL_VALUE = "all";

/**
 * Liegenschafts-Filter (analog UnitPropertyFilter/BillingPropertyFilter),
 * aber für WEGs - ermöglicht die Auswahl einer WEG auf den nun flachen
 * Top-Level-Seiten unter /weg/* (Wirtschaftsplan, Jahresabrechnung,
 * Hausgeld, Rücklage, Versammlungen, Beschluss-Sammlung,
 * Eigentumsverhältnisse, Verteilerschlüssel) - konsistent zum Muster der
 * Mietverwaltung (z. B. /einheiten?propertyId=).
 */
export function HoaFilter({ hoas, value, basePath }: { hoas: Hoa[]; value?: string; basePath: string }) {
	const router = useRouter();

	return (
		<Select
			value={value ?? ALL_VALUE}
			onValueChange={(next) => {
				router.push(next === ALL_VALUE ? basePath : `${basePath}?hoaId=${next}`);
			}}
		>
			<SelectTrigger className="w-full sm:w-64">
				<SelectValue placeholder="WEG auswählen" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_VALUE}>Alle WEGs</SelectItem>
				{hoas.map((hoa) => (
					<SelectItem key={hoa.id} value={hoa.id}>
						{hoa.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
