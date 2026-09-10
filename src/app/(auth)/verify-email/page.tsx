import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markEmailVerified } from "@/data/users";
import { consumeVerificationToken } from "@/lib/auth/tokens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getT();
	return { title: t("auth.meta.verifyEmail") };
}

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	const t = await getT();
	const { token } = await searchParams;

	if (!token) {
		return <ResultCard success={false} message={t("auth.verify.noToken")} />;
	}

	const result = await consumeVerificationToken(token);

	if (!result.success) {
		return <ResultCard success={false} message={t(result.errorKey)} />;
	}

	markEmailVerified(result.identifier);

	return <ResultCard success={true} message={t("auth.verify.success")} />;
}

async function ResultCard({ success, message }: { success: boolean; message: string }) {
	const t = await getT();
	return (
		<Card>
			<CardHeader>
				<div className="mb-2 flex items-center gap-2">
					{success ? <CheckCircle2 className="size-6 text-emerald-600" /> : <XCircle className="size-6 text-destructive" />}
					<CardTitle>{success ? t("auth.verify.successTitle") : t("auth.verify.errorTitle")}</CardTitle>
				</div>
				<CardDescription>{message}</CardDescription>
			</CardHeader>
			<CardContent />
			<CardFooter>
				<Button asChild className="w-full">
					<Link href="/login">{t("auth.verify.toLogin")}</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
