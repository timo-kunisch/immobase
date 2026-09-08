import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Ladeplatzhalter für Seiten im App-Bereich (src/app/(app)/loading.tsx).
 * Bildet den typischen Aufbau der Listen-Seiten nach (SiteHeader mit
 * Sidebar-Trigger + Titel, dann Inhaltskarte mit Tabellenzeilen), damit
 * der Übergang zur fertigen Seite ohne Layout-Sprung wirkt.
 */
export function PageSkeleton() {
	return (
		<div className="flex flex-1 flex-col" aria-busy="true" aria-label="Seite wird geladen">
			<header className="flex flex-col gap-4 border-b bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<div className="flex items-center gap-3">
					<Skeleton className="size-8" />
					<Separator orientation="vertical" className="h-6" />
					<div className="space-y-2">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-4 w-64" />
					</div>
				</div>
			</header>
			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Skeleton className="h-9 w-full max-w-xs" />
				<Card>
					<CardContent className="space-y-3 p-4">
						<Skeleton className="h-9 w-full" />
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton key={index} className="h-11 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
