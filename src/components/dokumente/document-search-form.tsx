import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DocumentSearchForm({ defaultValue }: { defaultValue?: string }) {
	return (
		<form action="/dokumente" className="flex w-full max-w-sm items-center gap-2">
			<div className="relative flex-1">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input type="search" name="q" placeholder="Dokumente durchsuchen…" defaultValue={defaultValue} className="pl-8" />
			</div>
			<Button type="submit" variant="outline">
				Suchen
			</Button>
		</form>
	);
}
