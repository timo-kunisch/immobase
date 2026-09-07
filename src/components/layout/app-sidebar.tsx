"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Building2,
	Calculator,
	CalendarDays,
	DoorOpen,
	FileSignature,
	FileText,
	FolderOpen,
	Gavel,
	LayoutDashboard,
	LogOut,
	PiggyBank,
	Scale,
	Settings,
	ShieldCheck,
	Users,
	UserSquare2,
	Wallet,
	Wrench,
} from "lucide-react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ContactAdminDialog } from "@/components/layout/contact-admin-dialog";
import { logoutAction } from "@/lib/auth/actions";

/**
 * Navigationseinträge gegliedert nach fachlichem Bereich - macht die
 * additive Struktur der App
 * (allgemeine Stammdaten + Mietverwaltung + WEG-Verwaltung, siehe
 * AGENTS.md Abschnitt 1) auch in der Sidebar sichtbar. "Allgemein" enthält
 * bewusst alles, was unabhängig davon relevant ist, ob eine Liegenschaft
 * vermietet und/oder eine WEG ist (Stammdaten, Instandhaltung, DMS) - die
 * beiden Fachbereiche darunter enthalten ausschließlich Module, die
 * jeweils nur für Mietverhältnisse bzw. nur für WEGs Sinn ergeben.
 */
const generalNavItems = [
	{ title: "Dashboard", href: "/", icon: LayoutDashboard },
	{ title: "Liegenschaften", href: "/liegenschaften", icon: Building2 },
	{ title: "Einheiten", href: "/einheiten", icon: DoorOpen },
	{ title: "Tickets", href: "/tickets", icon: Wrench },
	{ title: "Dokumente", href: "/dokumente", icon: FolderOpen },
];

const rentalNavItems = [
	{ title: "Mieter", href: "/mieter", icon: Users },
	{ title: "Verträge", href: "/vertraege", icon: FileSignature },
	{ title: "Finanzen", href: "/finanzen", icon: Wallet },
	{ title: "Abrechnung", href: "/abrechnung", icon: Calculator },
	{ title: "Vorlagen", href: "/vorlagen", icon: FileText },
];

const wegNavItems = [
	{ title: "WEGs", href: "/weg", icon: Building2 },
	{ title: "Eigentümer", href: "/weg/eigentuemer", icon: UserSquare2 },
	{ title: "Eigentumsverhältnisse", href: "/weg/eigentumsverhaeltnisse", icon: Users },
	{ title: "Verteilerschlüssel", href: "/weg/verteilerschluessel", icon: Scale },
	{ title: "Wirtschaftsplan", href: "/weg/wirtschaftsplan", icon: Calculator },
	{ title: "Jahresabrechnung", href: "/weg/jahresabrechnung", icon: FileText },
	{ title: "Hausgeld", href: "/weg/hausgeld", icon: Wallet },
	{ title: "Rücklage", href: "/weg/ruecklage", icon: PiggyBank },
	{ title: "Versammlungen", href: "/weg/versammlungen", icon: CalendarDays },
	{ title: "Beschluss-Sammlung", href: "/weg/beschluesse", icon: Gavel },
];

const adminNavItems = [
	{ title: "Nutzerverwaltung", href: "/admin/users", icon: ShieldCheck },
	{ title: "Einstellungen", href: "/einstellungen", icon: Settings },
];

export function AppSidebar({ user }: { user: { email: string; role: string } }) {
	const pathname = usePathname();

	// "/" und "/weg" sind exakte Matches (sonst wäre der Dashboard- bzw.
	// "WEGs"-Eintrag fälschlich auch auf allen jeweiligen Unterseiten aktiv,
	// die eigene, gleichrangige Sidebar-Einträge sind, z. B. /weg/hausgeld).
	const isItemActive = (href: string) => (href === "/" || href === "/weg" ? pathname === href : pathname.startsWith(href));

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="flex items-center gap-2 px-2 py-1.5">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<Building2 className="size-4" />
					</div>
					<div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
						<span className="text-sm font-semibold">ImmoBase</span>
						<span className="text-xs text-muted-foreground">Verwaltungssoftware</span>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Allgemein</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{generalNavItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={item.title}>
										<Link href={item.href}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Mietverwaltung</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{rentalNavItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={item.title}>
										<Link href={item.href}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>WEG-Verwaltung</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{wegNavItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={item.title}>
										<Link href={item.href}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				{user.role === "ADMIN" ? (
					<SidebarGroup>
						<SidebarGroupLabel>Administration</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{adminNavItems.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={item.title}>
											<Link href={item.href}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter>
				<div className="flex items-center gap-2 px-1 py-1">
					<div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
						<span className="truncate text-xs font-medium">{user.email}</span>
						<span className="text-xs text-muted-foreground">{user.role === "ADMIN" ? "Administrator" : "Nutzer"}</span>
					</div>
					<ContactAdminDialog />
					<form action={logoutAction}>
						<Button type="submit" variant="ghost" size="icon-sm" title="Abmelden" aria-label="Abmelden">
							<LogOut className="size-4" />
						</Button>
					</form>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
