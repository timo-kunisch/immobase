import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

/** Suchformular der Wissensdatenbank (GET-Formular, Suchbegriff als ?q=-Parameter). */
export async function ArticleSearchForm({ defaultValue }: { defaultValue?: string }) {
	const t = await getT();
	return (
		<form action="/wissen" className="flex w-full max-w-sm items-center gap-2">
			<div className="relative flex-1">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input type="search" name="q" placeholder={t("knowledge.search.placeholder")} defaultValue={defaultValue} className="pl-8" />
			</div>
			<Button type="submit" variant="outline">
				{t("common.search")}
			</Button>
		</form>
	);
}
