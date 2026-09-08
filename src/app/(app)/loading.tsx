import { PageSkeleton } from "@/components/layout/page-skeleton";

/**
 * Ladezustand für alle Seiten im geschützten App-Bereich: Während eine
 * Server-Component-Seite (force-dynamic) gerendert wird, zeigt Next.js
 * diesen Platzhalter an - das App-Layout mit Sidebar bleibt dabei
 * unverändert sichtbar (Suspense-Grenze unterhalb des Layouts).
 */
export default function Loading() {
	return <PageSkeleton />;
}
