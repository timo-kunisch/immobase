import { Building2 } from "lucide-react";

/**
 * Layout für alle öffentlichen Auth-Seiten (Login, Registrierung,
 * E-Mail-Verifizierung, Passwort vergessen/zurücksetzen). Bewusst ohne
 * Sidebar/Navigation – diese Seiten sind auch für nicht angemeldete
 * Besucher erreichbar (siehe PUBLIC_PATHS in src/proxy.ts).
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
			<div className="flex items-center gap-2">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<Building2 className="size-5" />
				</div>
				<span className="text-lg font-semibold">ImmoBase</span>
			</div>
			<div className="w-full max-w-sm">{children}</div>
		</div>
	);
}
