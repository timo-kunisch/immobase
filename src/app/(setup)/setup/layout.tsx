import { Building2 } from "lucide-react";

/**
 * Eigenes Layout für die Ersteinrichtung (Setup-Wizard): öffentlich
 * erreichbar ohne Sidebar (wie die Auth-Seiten), aber breiter als das
 * schmale Auth-Layout, weil die Schritte Einstellungs-Formulare enthalten.
 */
export default function SetupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
			<div className="flex items-center gap-2">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<Building2 className="size-5" />
				</div>
				<span className="text-lg font-semibold">ImmoBase</span>
			</div>
			<div className="w-full max-w-xl">{children}</div>
		</div>
	);
}
