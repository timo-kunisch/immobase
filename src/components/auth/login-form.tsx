"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { loginAction } from "@/app/(auth)/login/actions";
import { initialLoginState } from "@/lib/auth/login-state";
import { resendVerificationAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/action-state";

export function LoginForm({ defaultEmail, from, infoMessage }: { defaultEmail?: string; from?: string; infoMessage?: string }) {
	const [state, formAction, isPending] = useActionState(loginAction, initialLoginState);
	const [resendState, resendAction, isResendPending] = useActionState(resendVerificationAction, initialActionState);

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<form action={formAction}>
					<CardHeader>
						<CardTitle>Anmelden</CardTitle>
						<CardDescription>Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						{infoMessage ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{infoMessage}</p> : null}
						{from ? <input type="hidden" name="from" value={from} /> : null}
						<div className="grid gap-2">
							<Label htmlFor="email">E-Mail-Adresse</Label>
							<Input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
						</div>
						<div className="grid gap-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="password">Passwort</Label>
								<Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
									Passwort vergessen?
								</Link>
							</div>
							<Input id="password" name="password" type="password" autoComplete="current-password" required />
						</div>
						{state.error ? (
							<div className="space-y-2 rounded-md bg-destructive/10 px-3 py-2">
								<p className="text-sm text-destructive">{state.error}</p>
								{state.unverifiedEmail ? (
									<form action={resendAction}>
										<input type="hidden" name="email" value={state.unverifiedEmail} />
										<Button type="submit" variant="outline" size="sm" disabled={isResendPending}>
											{isResendPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
											Bestätigungs-E-Mail erneut senden
										</Button>
									</form>
								) : null}
							</div>
						) : null}
						{resendState.message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{resendState.message}</p> : null}
					</CardContent>
					<CardFooter className="flex flex-col gap-4">
						<Button type="submit" className="w-full" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Anmelden
						</Button>
						<p className="text-center text-sm text-muted-foreground">
							Noch kein Konto?{" "}
							<Link href="/register" className="text-primary hover:underline">
								Jetzt registrieren
							</Link>
						</p>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
