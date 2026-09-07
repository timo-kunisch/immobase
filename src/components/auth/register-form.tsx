"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { registerAction } from "@/app/(auth)/register/actions";

export function RegisterForm() {
	const [state, formAction, isPending] = useActionState(registerAction, initialActionState);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>Konto erstellen</CardTitle>
					<CardDescription>Registrieren Sie sich für ImmoBase. Der erste registrierte Nutzer wird automatisch Administrator.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">E-Mail-Adresse</Label>
						<Input id="email" name="email" type="email" autoComplete="email" required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Passwort</Label>
						<Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="passwordConfirm">Passwort wiederholen</Label>
						<Input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
				</CardContent>
				<CardFooter className="flex flex-col gap-4">
					<Button type="submit" className="w-full" disabled={isPending}>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						Registrieren
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						Bereits ein Konto?{" "}
						<Link href="/login" className="text-primary hover:underline">
							Jetzt anmelden
						</Link>
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
