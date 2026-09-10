import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getT();
	return { title: t("auth.meta.forgotPassword") };
}

// Siehe Kommentar in app/(auth)/register/page.tsx: Ohne force-dynamic würde
// diese Seite statisch prerendert und nach jedem neuen Deployment eine
// veraltete Server-Action-Referenz sowie alte Chunk-Pfade ausliefern.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
	return <ForgotPasswordForm />;
}
