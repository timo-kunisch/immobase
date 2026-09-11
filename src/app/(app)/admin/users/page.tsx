import { Users } from "lucide-react";

import { listUsers } from "@/data/users";
import { requireUser } from "@/lib/auth/dal";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { UsersTable, type UserRow } from "@/components/admin/users-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
	// requireAdmin() lief bereits im übergeordneten app/(app)/admin/layout.tsx;
	// hier zusätzlich requireUser(), um die eigene User-ID für den
	// Aussperr-Schutz (kein Self-Toggle) zu bekommen.
	const currentUser = await requireUser();
	const t = await getT();

	// Passwort-Hash bewusst nicht an die Client-Tabelle übergeben.
	const rows: UserRow[] = listUsers().map(({ passwordHash: _passwordHash, ...user }) => user);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("admin.users.title")} description={t("admin.users.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>{t("admin.users.empty")}</p>
							</div>
						) : (
							<UsersTable rows={rows} currentUserId={currentUser.id} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
