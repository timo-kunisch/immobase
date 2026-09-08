import { BookOpen, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Aufklappbarer Schritt-für-Schritt-Leitfaden für komplexere Einstellungen
 * (z. B. KI-Assistent, Dropbox-Backup). Baut auf dem nativen
 * <details>-Element auf - kein State nötig, standardmäßig eingeklappt,
 * damit erfahrene Nutzer nicht gestört werden.
 *
 * Bewusst ohne "use client": Die Komponente hat keine Hooks/Handler und
 * kann dadurch sowohl von Server- als auch von Client-Komponenten
 * (den Einstellungs-Karten) genutzt werden.
 */
export function Guide({ title, children }: { title: string; children: ReactNode }) {
	return (
		<details className="group rounded-md border bg-muted/30 text-sm">
			<summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-3 font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
				<BookOpen className="size-4 shrink-0 text-primary" />
				{title}
				<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
			</summary>
			<div className="space-y-4 border-t p-4">{children}</div>
		</details>
	);
}

/** Ein einzelner nummerierter Schritt innerhalb eines <Guide>. */
export function GuideStep({ step, title, children }: { step: number; title: string; children: ReactNode }) {
	return (
		<div className="flex gap-3">
			<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
				{step}
			</span>
			<div className="space-y-1">
				<p className="font-medium">{title}</p>
				<div className="space-y-1 leading-relaxed text-muted-foreground">{children}</div>
			</div>
		</div>
	);
}
