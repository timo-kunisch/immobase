import { ShieldCheck, Users } from "lucide-react";

import { listUsers } from "@/data/users";
import { requireUser } from "@/lib/auth/dal";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { UserApprovalSwitch } from "@/components/admin/user-approval-switch";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
	// requireAdmin() lief bereits im übergeordneten app/(app)/admin/layout.tsx;
	// hier zusätzlich requireUser(), um die eigene User-ID für den
	// Aussperr-Schutz (kein Self-Toggle) zu bekommen.
	const currentUser = await requireUser();
	const t = await getT();

	const userList = listUsers();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("admin.users.title")} description={t("admin.users.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{userList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>{t("admin.users.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("admin.users.table.email")}</TableHead>
										<TableHead>{t("admin.users.table.role")}</TableHead>
										<TableHead>{t("admin.users.table.emailVerified")}</TableHead>
										<TableHead>{t("admin.users.table.registeredAt")}</TableHead>
										<TableHead className="w-[140px]">{t("admin.users.table.approved")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{userList.map((user) => (
										<TableRow key={user.id}>
											<TableCell className="font-medium">
												{user.email}
												{user.id === currentUser.id ? <span className="ml-2 text-xs text-muted-foreground">{t("admin.users.currentUser")}</span> : null}
											</TableCell>
											<TableCell>
												{user.role === "ADMIN" ? (
													<Badge className="gap-1">
														<ShieldCheck className="size-3.5" />
														{t("admin.users.role.ADMIN")}
													</Badge>
												) : (
													<Badge variant="secondary">{t("admin.users.role.USER")}</Badge>
												)}
											</TableCell>
											<TableCell>
												{user.emailVerified ? (
													<span className="text-emerald-700 dark:text-emerald-400">{t("admin.users.emailVerified.yes")}</span>
												) : (
													<span className="text-muted-foreground">{t("admin.users.emailVerified.pending")}</span>
												)}
											</TableCell>
											<TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
											<TableCell>
												<UserApprovalSwitch userId={user.id} initialApproved={user.isApproved} disabled={user.id === currentUser.id} />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
