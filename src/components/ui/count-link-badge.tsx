import Link from "next/link";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

/**
 * Kleine, klickbare Badge zur Anzeige einer Anzahl verknüpfter Datensätze
 * (z. B. "3 Einheiten"), die zur entsprechenden gefilterten Liste verlinkt.
 * Bei count === 0 wird kein Link gerendert (nichts zum Navigieren vorhanden).
 */
export function CountLinkBadge({
	href,
	count,
	label,
	icon: Icon,
	className,
}: {
	href: string;
	count: number;
	label: string;
	icon?: ComponentType<{ className?: string }>;
	className?: string;
}) {
	const content = (
		<>
			{Icon ? <Icon className="size-3" /> : null}
			{count} {label}
		</>
	);

	if (count === 0) {
		return <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground", className)}>{content}</span>;
	}

	return (
		<Link
			href={href}
			className={cn(
				"inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
				className
			)}
		>
			{content}
		</Link>
	);
}
