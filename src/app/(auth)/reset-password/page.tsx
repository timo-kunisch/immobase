import Link from "next/link";
import type { Metadata } from "next";
import { XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { isValidPasswordResetToken } from "@/lib/auth/tokens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getT();
	return { title: t("auth.meta.resetPassword") };
}

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
	const t = await getT();
	const { token } = await searchParams;

	const isValid = token ? await isValidPasswordResetToken(token) : false;

	if (!token || !isValid) {
		return (
			<Card>
				<CardHeader>
					<div className="mb-2 flex items-center gap-2">
						<XCircle className="size-6 text-destructive" />
						<CardTitle>{t("auth.reset.invalidTitle")}</CardTitle>
					</div>
					<CardDescription>{t("auth.reset.invalidDescription")}</CardDescription>
				</CardHeader>
				<CardContent />
				<CardFooter>
					<Button asChild className="w-full">
						<Link href="/forgot-password">{t("auth.reset.requestNewLink")}</Link>
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return <ResetPasswordForm token={token} />;
}
