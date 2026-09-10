"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { forgotPasswordAction } from "@/app/(auth)/forgot-password/actions";

export function ForgotPasswordForm() {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialActionState);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>{t("auth.forgot.title")}</CardTitle>
					<CardDescription>{t("auth.forgot.description")}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">{t("auth.fields.email")}</Label>
						<Input id="email" name="email" type="email" autoComplete="email" required disabled={state.success} />
					</div>
<ActionErrorToast state={state} />
				{state.message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{state.message}</p> : null}
				</CardContent>
				<CardFooter className="flex flex-col gap-4">
					<Button type="submit" className="w-full" disabled={isPending || state.success}>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						{t("auth.forgot.submit")}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						<Link href="/login" className="text-primary hover:underline">
							{t("auth.forgot.backToLogin")}
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
