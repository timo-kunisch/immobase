"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { resetPasswordAction } from "@/app/(auth)/reset-password/actions";

export function ResetPasswordForm({ token }: { token: string }) {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(resetPasswordAction, initialActionState);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>{t("auth.reset.title")}</CardTitle>
					<CardDescription>{t("auth.reset.description")}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<input type="hidden" name="token" value={token} />
					<div className="grid gap-2">
						<Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
						<Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="passwordConfirm">{t("auth.register.passwordConfirm")}</Label>
						<Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<ActionErrorToast state={state} />
				</CardContent>
				<CardFooter>
					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						{t("auth.reset.submit")}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
