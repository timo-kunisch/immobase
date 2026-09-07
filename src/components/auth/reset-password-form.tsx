"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { resetPasswordAction } from "@/app/(auth)/reset-password/actions";

export function ResetPasswordForm({ token }: { token: string }) {
	const [state, formAction, isPending] = useActionState(resetPasswordAction, initialActionState);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>Neues Passwort vergeben</CardTitle>
					<CardDescription>Bitte vergeben Sie ein neues Passwort für Ihr Konto.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<input type="hidden" name="token" value={token} />
					<div className="grid gap-2">
						<Label htmlFor="password">Neues Passwort</Label>
						<Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="passwordConfirm">Passwort wiederholen</Label>
						<Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
				</CardContent>
				<CardFooter>
					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						Passwort speichern
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
