import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markEmailVerified } from "@/data/users";
import { consumeVerificationToken } from "@/lib/auth/tokens";

export const metadata: Metadata = {
	title: "E-Mail bestätigen – ImmoBase",
};

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	const { token } = await searchParams;

	if (!token) {
		return <ResultCard success={false} message="Es wurde kein Bestätigungs-Token übergeben. Bitte verwenden Sie den Link aus Ihrer E-Mail." />;
	}

	const result = await consumeVerificationToken(token);

	if (!result.success) {
		return <ResultCard success={false} message={result.error} />;
	}

	markEmailVerified(result.identifier);

	return <ResultCard success={true} message="Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie können sich nun anmelden – sofern Ihr Konto bereits von einem Administrator freigeschaltet wurde." />;
}

function ResultCard({ success, message }: { success: boolean; message: string }) {
	return (
		<Card>
			<CardHeader>
				<div className="mb-2 flex items-center gap-2">
					{success ? <CheckCircle2 className="size-6 text-emerald-600" /> : <XCircle className="size-6 text-destructive" />}
					<CardTitle>{success ? "E-Mail bestätigt" : "Bestätigung fehlgeschlagen"}</CardTitle>
				</div>
				<CardDescription>{message}</CardDescription>
			</CardHeader>
			<CardContent />
			<CardFooter>
				<Button asChild className="w-full">
					<Link href="/login">Zur Anmeldung</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
