"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	BookOpen,
	Building2,
	Calculator,
	CalendarDays,
	CalendarRange,
	DoorOpen,
	FileSignature,
	FileText,
	FolderOpen,
	Gavel,
	Inbox,
	Landmark,
	LayoutDashboard,
	LogOut,
	PiggyBank,
	Scale,
	ScrollText,
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
import { ChatbotDialog } from "@/components/layout/chatbot-dialog";
import { logoutAction } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";
import { cn } from "@/lib/utils";

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
// Die Titel liegen als Übersetzungsschlüssel vor (Namespace "nav") und
// werden erst im Komponenten-Rumpf über t() aufgelöst, weil die Arrays hier
// auf Modulebene stehen (kein Hook-Zugriff außerhalb der Komponente).
const generalNavItems: { titleKey: MessageKey; href: string; icon: typeof LayoutDashboard }[] = [
	{ titleKey: "nav.item.dashboard", href: "/", icon: LayoutDashboard },
	{ titleKey: "nav.item.properties", href: "/liegenschaften", icon: Building2 },
	{ titleKey: "nav.item.units", href: "/einheiten", icon: DoorOpen },
	{ titleKey: "nav.item.tickets", href: "/tickets", icon: Wrench },
	{ titleKey: "nav.item.documents", href: "/dokumente", icon: FolderOpen },
	{ titleKey: "nav.item.calendar", href: "/kalender", icon: CalendarRange },
	{ titleKey: "nav.item.knowledge", href: "/wissen", icon: BookOpen },
];

const rentalNavItems: { titleKey: MessageKey; href: string; icon: typeof LayoutDashboard }[] = [
	{ titleKey: "nav.item.tenants", href: "/mieter", icon: Users },
	{ titleKey: "nav.item.leases", href: "/vertraege", icon: FileSignature },
	{ titleKey: "nav.item.finances", href: "/finanzen", icon: Wallet },
	{ titleKey: "nav.item.accounting", href: "/buchhaltung", icon: Landmark },
	{ titleKey: "nav.item.billing", href: "/abrechnung", icon: Calculator },
	{ titleKey: "nav.item.templates", href: "/vorlagen", icon: FileText },
];

const wegNavItems: { titleKey: MessageKey; href: string; icon: typeof LayoutDashboard }[] = [
	{ titleKey: "nav.item.hoas", href: "/weg", icon: Building2 },
	{ titleKey: "nav.item.owners", href: "/weg/eigentuemer", icon: UserSquare2 },
	{ titleKey: "nav.item.ownerships", href: "/weg/eigentumsverhaeltnisse", icon: Users },
	{ titleKey: "nav.item.allocationKeys", href: "/weg/verteilerschluessel", icon: Scale },
	{ titleKey: "nav.item.economicPlan", href: "/weg/wirtschaftsplan", icon: Calculator },
	{ titleKey: "nav.item.annualStatements", href: "/weg/jahresabrechnung", icon: FileText },
	{ titleKey: "nav.item.housingCharges", href: "/weg/hausgeld", icon: Wallet },
	{ titleKey: "nav.item.reserveFund", href: "/weg/ruecklage", icon: PiggyBank },
	{ titleKey: "nav.item.meetings", href: "/weg/versammlungen", icon: CalendarDays },
	{ titleKey: "nav.item.resolutions", href: "/weg/beschluesse", icon: Gavel },
];

const adminNavItems: { titleKey: MessageKey; href: string; icon: typeof LayoutDashboard }[] = [
	{ titleKey: "nav.item.users", href: "/admin/users", icon: ShieldCheck },
	{ titleKey: "nav.item.auditLog", href: "/admin/logs", icon: ScrollText },
	{ titleKey: "nav.item.settings", href: "/einstellungen", icon: Settings },
];

export function AppSidebar({
	user,
	aiConfigured,
	mailboxEnabled,
}: {
	user: { email: string; role: string };
	aiConfigured: boolean;
	mailboxEnabled: boolean;
}) {
	const pathname = usePathname();
	const { t } = useI18n();

	// Das Postfach (E-Mail-Eingang per IMAP) erscheint nur, wenn der Admin
	// einen IMAP-Server konfiguriert hat (optionale Online-Funktion).
	const generalItems = mailboxEnabled
		? [...generalNavItems.slice(0, 4), { titleKey: "nav.item.mailbox" as MessageKey, href: "/postfach", icon: Inbox }, ...generalNavItems.slice(4)]
		: generalNavItems;

	// "/" und "/weg" sind exakte Matches (sonst wäre der Dashboard- bzw.
	// "WEGs"-Eintrag fälschlich auch auf allen jeweiligen Unterseiten aktiv,
	// die eigene, gleichrangige Sidebar-Einträge sind, z. B. /weg/hausgeld).
	const isItemActive = (href: string) => (href === "/" || href === "/weg" ? pathname === href : pathname.startsWith(href));

	// Scroll-Hinweise: Die Menüliste ist scrollbar (SidebarContent hat
	// "overflow-auto" bei ausgeblendeter Scrollbar). Damit erkennbar ist,
	// dass es weitere Einträge gibt, wird - abhängig von der
	// Scrollposition - ein Ausblend-Verlauf am oberen/unteren Rand
	// eingeblendet.
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [canScrollUp, setCanScrollUp] = useState(false);
	const [canScrollDown, setCanScrollDown] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const threshold = 4;
		setCanScrollUp(el.scrollTop > threshold);
		setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - threshold);
	}, []);

	useEffect(() => {
		updateScrollState();
		const el = scrollRef.current;
		if (!el) return;
		// Fenstergrößenänderungen (und damit Höhenänderungen der Sidebar)
		// verändern, ob bzw. wie weit gescrollt werden kann.
		const observer = new ResizeObserver(updateScrollState);
		observer.observe(el);
		return () => observer.disconnect();
	}, [updateScrollState]);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				{/* Externer Link: In der Electron-Shell fängt der setWindowOpenHandler
				    des Main-Prozesses target="_blank" ab und öffnet die Seite im
				    Standardbrowser (siehe electron/main/index.ts); im Browser-Dev-
				    Modus öffnet sich einfach ein neuer Tab. */}
				<a
					href="https://immobase.app"
					target="_blank"
					rel="noopener noreferrer"
					title={t("nav.openWebsite")}
					className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-accent"
				>
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<Building2 className="size-4" />
					</div>
					<div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
						<span className="text-sm font-semibold">ImmoBase</span>
						<span className="text-xs text-muted-foreground">{t("nav.appTagline")}</span>
					</div>
				</a>
			</SidebarHeader>
			{/* Der Wrapper macht die Scroll-Overlays positionsverankert
			    (relative) und erhält den Flex-Platz, den sonst SidebarContent
			    direkt einnähme (flex-1 min-h-0). */}
			<div className="relative flex min-h-0 flex-1 flex-col">
				<SidebarContent ref={scrollRef} onScroll={updateScrollState}>
					<SidebarGroup>
						<SidebarGroupLabel>{t("nav.group.general")}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{generalItems.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={t(item.titleKey)}>
											<Link href={item.href}>
												<item.icon />
												<span>{t(item.titleKey)}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					<SidebarGroup>
						<SidebarGroupLabel>{t("nav.group.rental")}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{rentalNavItems.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={t(item.titleKey)}>
											<Link href={item.href}>
												<item.icon />
												<span>{t(item.titleKey)}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					<SidebarGroup>
						<SidebarGroupLabel>{t("nav.group.hoa")}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{wegNavItems.map((item) => (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={t(item.titleKey)}>
											<Link href={item.href}>
												<item.icon />
												<span>{t(item.titleKey)}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					{user.role === "ADMIN" ? (
						<SidebarGroup>
							<SidebarGroupLabel>{t("nav.group.admin")}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{adminNavItems.map((item) => (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton asChild isActive={isItemActive(item.href)} tooltip={t(item.titleKey)}>
												<Link href={item.href}>
													<item.icon />
													<span>{t(item.titleKey)}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					) : null}
				</SidebarContent>
				{/* Scroll-Hinweise (nur sichtbar, wenn in die jeweilige Richtung
				    weitergescrollt werden kann). Im eingeklappten Icon-Modus ist
				    der Inhalt nicht scrollbar, dort werden sie ausgeblendet. */}
				<div
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-sidebar to-transparent transition-opacity group-data-[collapsible=icon]:hidden",
						canScrollUp ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-sidebar from-30% to-transparent transition-opacity group-data-[collapsible=icon]:hidden",
						canScrollDown ? "opacity-100" : "opacity-0",
					)}
				/>
			</div>
			<SidebarFooter>
				<div className="flex items-center gap-2 px-1 py-1">
					<div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
						<span className="truncate text-xs font-medium">{user.email}</span>
						<span className="text-xs text-muted-foreground">{user.role === "ADMIN" ? t("nav.role.admin") : t("nav.role.user")}</span>
					</div>
					<ChatbotDialog aiConfigured={aiConfigured} />
					<form action={logoutAction}>
						<Button type="submit" variant="ghost" size="icon-sm" title={t("nav.logout")} aria-label={t("nav.logout")}>
							<LogOut className="size-4" />
						</Button>
					</form>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
