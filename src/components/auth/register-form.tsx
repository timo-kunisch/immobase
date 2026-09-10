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

import { registerAction } from "@/app/(auth)/register/actions";

export function RegisterForm() {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(registerAction, initialActionState);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>{t("auth.register.title")}</CardTitle>
					<CardDescription>{t("auth.register.description")}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">{t("auth.fields.email")}</Label>
						<Input id="email" name="email" type="email" autoComplete="email" required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">{t("auth.fields.password")}</Label>
						<Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="passwordConfirm">{t("auth.register.passwordConfirm")}</Label>
						<Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<ActionErrorToast state={state} />
				</CardContent>
				<CardFooter className="flex flex-col gap-4">
					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						{t("auth.register.submit")}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						{t("auth.register.haveAccount")}{" "}
						<Link href="/login" className="text-primary hover:underline">
							{t("auth.register.loginNow")}
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
