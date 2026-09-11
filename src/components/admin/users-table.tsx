"use client";

import { ShieldCheck } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { UserApprovalSwitch } from "@/components/admin/user-approval-switch";
import type { User } from "@/data/types";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

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
			key: "email",
			header: t("admin.users.table.email"),
			sortValue: (row) => row.email,
			filter: { type: "text", value: (row) => row.email },
			cell: (row) => (
				<span className="font-medium">
					{row.email}
					{row.id === currentUserId ? <span className="ml-2 text-xs text-muted-foreground">{t("admin.users.currentUser")}</span> : null}
				</span>
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
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
