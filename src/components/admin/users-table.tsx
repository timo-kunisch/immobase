"use client";

import { ShieldCheck } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { UserApprovalSwitch } from "@/components/admin/user-approval-switch";
import { UserNameDialog } from "@/components/admin/user-name-dialog";
import type { User } from "@/data/types";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { userDisplayName } from "@/lib/user-name";

/**
 * Zeile der Benutzer-Tabelle: bewusst ohne Passwort-Hash, damit dieses
 * nicht im RSC-Payload an den Client serialisiert wird.
 */
export type UserRow = Omit<User, "passwordHash">;

/** Tabelle der registrierten Nutzer (Rolle/Freigabe als Select-Filter). */
export function UsersTable({ rows, currentUserId }: { rows: UserRow[]; currentUserId: string }) {
	const { t } = useI18n();

	const columns: DataTableColumn<UserRow>[] = [
		{
			// Identitäts-Spalte: Anzeige-Name („Vorname Nachname", Fallback
			// E-Mail bei Altkonten) mit der E-Mail-Adresse als Nebenzeile -
			// der Name ist die Bezeichnung des Nutzers, die Adresse bleibt
			// als Login-/Kontaktinformation sichtbar.
			key: "name",
			header: t("admin.users.table.name"),
			sortValue: (row) => userDisplayName(row),
			filter: { type: "text", value: (row) => `${userDisplayName(row)} ${row.email}` },
			cell: (row) => (
				<div className="flex flex-col">
					<span className="font-medium">
						{userDisplayName(row)}
						{row.id === currentUserId ? <span className="ml-2 text-xs text-muted-foreground">{t("admin.users.currentUser")}</span> : null}
					</span>
					<span className="text-xs text-muted-foreground">{row.email}</span>
				</div>
			),
		},
		{
			key: "role",
			header: t("admin.users.table.role"),
			sortValue: (row) => t(`admin.users.role.${row.role}`),
			filter: {
				type: "select",
				value: (row) => row.role,
				options: [
					{ value: "ADMIN", label: t("admin.users.role.ADMIN") },
					{ value: "USER", label: t("admin.users.role.USER") },
				],
			},
			cell: (row) =>
				row.role === "ADMIN" ? (
					<Badge className="gap-1">
						<ShieldCheck className="size-3.5" />
						{t("admin.users.role.ADMIN")}
					</Badge>
				) : (
					<Badge variant="secondary">{t("admin.users.role.USER")}</Badge>
				),
		},
		{
			key: "emailVerified",
			header: t("admin.users.table.emailVerified"),
			sortValue: (row) => (row.emailVerified ? 0 : 1),
			filter: {
				type: "select",
				value: (row) => (row.emailVerified ? "YES" : "PENDING"),
				options: [
					{ value: "YES", label: t("admin.users.emailVerified.yes") },
					{ value: "PENDING", label: t("admin.users.emailVerified.pending") },
				],
			},
			cell: (row) =>
				row.emailVerified ? (
					<span className="text-emerald-700 dark:text-emerald-400">{t("admin.users.emailVerified.yes")}</span>
				) : (
					<span className="text-muted-foreground">{t("admin.users.emailVerified.pending")}</span>
				),
		},
		{
			key: "registeredAt",
			header: t("admin.users.table.registeredAt"),
			sortValue: (row) => row.createdAt,
			filter: { type: "text", value: (row) => formatDate(row.createdAt) },
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>,
		},
		{
			key: "approved",
			header: t("admin.users.table.approved"),
			headClassName: "w-[140px]",
			sortValue: (row) => (row.isApproved ? 0 : 1),
			filter: {
				type: "select",
				value: (row) => (row.isApproved ? "YES" : "NO"),
				options: [
					{ value: "YES", label: t("admin.users.approved.yes") },
					{ value: "NO", label: t("admin.users.approved.no") },
				],
			},
			cell: (row) => <UserApprovalSwitch userId={row.id} initialApproved={row.isApproved} disabled={row.id === currentUserId} />,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[70px]",
			cell: (row) => (
				<div className="flex justify-end">
					<UserNameDialog user={row} />
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
