import Link from "next/link";
import type { Metadata } from "next";
import { XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { isValidPasswordResetToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
	title: "Passwort zurücksetzen – ImmoBase",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	const { token } = await searchParams;

	const isValid = token ? await isValidPasswordResetToken(token) : false;

	if (!token || !isValid) {
		return (
			<Card>
				<CardHeader>
					<div className="mb-2 flex items-center gap-2">
						<XCircle className="size-6 text-destructive" />
						<CardTitle>Link ungültig</CardTitle>
					</div>
					<CardDescription>Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen. Fordern Sie bitte einen neuen an.</CardDescription>
				</CardHeader>
				<CardContent />
				<CardFooter>
					<Button asChild className="w-full">
						<Link href="/forgot-password">Neuen Link anfordern</Link>
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return <ResetPasswordForm token={token} />;
}
