import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
	title: "Registrieren – ImmoBase",
};

// WICHTIG: Ohne dynamic="force-dynamic" prerendert Next.js diese Seite
// (kein searchParams/DB-Zugriff) statisch zur Build-Zeit – inkl. der darin
// eingebetteten Server-Action-Referenz (nicht-deterministische ID) und der
// Asset-Pfade zu den JS/CSS-Chunks. Nach jedem neuen Deployment würde dieses
// gecachte, statische HTML dann auf einen alten Build verweisen ("Failed to
// find Server Action ... This request might be from an older or newer
// deployment.") – sichtbar als kaputtes Design (404 auf alte Chunk-Pfade)
// und "Internal Server Error" beim Absenden des Formulars. Siehe
// https://nextjs.org/docs/messages/failed-to-find-server-action
export const dynamic = "force-dynamic";

export default function RegisterPage() {
	return <RegisterForm />;
}
