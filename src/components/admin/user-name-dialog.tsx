"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, PencilLine } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { updateUserNameAction } from "@/app/(app)/admin/users/actions";
import type { UserRow } from "@/components/admin/users-table";

/** Bearbeitet Vor- und Nachname eines Nutzerkontos (Admin). */
export function UserNameDialog({ user }: { user: UserRow }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(updateUserNameAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t("admin.users.edit.title")}
					title={t("admin.users.edit.title")}
				>
					<PencilLine className="size-4 text-muted-foreground" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("admin.users.edit.title")}</DialogTitle>
					</DialogHeader>

					<input type="hidden" name="userId" value={user.id} />

					<div className="grid gap-4 py-4">
						<p className="text-sm text-muted-foreground">{t("admin.users.edit.description", { email: user.email })}</p>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor={`user-first-name-${user.id}`}>{t("common.firstName")}</Label>
								<Input
									id={`user-first-name-${user.id}`}
									name="firstName"
									type="text"
									defaultValue={user.firstName ?? ""}
									maxLength={100}
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor={`user-last-name-${user.id}`}>{t("common.lastName")}</Label>
								<Input
									id={`user-last-name-${user.id}`}
									name="lastName"
									type="text"
									defaultValue={user.lastName ?? ""}
									maxLength={100}
									required
								/>
							</div>
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
