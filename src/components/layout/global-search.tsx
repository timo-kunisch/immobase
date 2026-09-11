"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
	BookOpen,
	Building2,
	Calculator,
	CalendarDays,
	CalendarRange,
	CornerDownLeft,
	DoorOpen,
	FileSignature,
	FileText,
	FolderOpen,
	Gavel,
	Inbox,
	Landmark,
	LayoutDashboard,
	Loader2,
	PiggyBank,
	Scale,
	ScrollText,
	Search,
	Settings,
	ShieldCheck,
	UserSquare2,
	Users,
	Wallet,
	Wrench,
} from "lucide-react";

import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";
import { SEARCH_PAGE_ENTRIES, type SearchPageEntry } from "@/lib/search-pages";
import { MIN_SEARCH_QUERY_LENGTH, type SearchEntityType, type SearchResponse, type SearchRow } from "@/lib/search-types";

/**
 * Globale Suche: Trigger-Knopf im Sidebar-Kopf + Command-Palette-Dialog
 * (Cmd/Ctrl+K). Die Fachdaten-Suche läuft serverseitig über die Route
 * /api/search (debounced, ab 2 Zeichen); die Navigations-/Einstellungsseiten
 * werden lokal gegen die lokalisierten Titel und Schlüsselwörter aus
 * src/lib/search-pages.ts gefiltert (ab 1 Zeichen).
 *
 * cmdk filtert hier nicht selbst (shouldFilter={false}), weil die
 * Datenbank-Treffer bereits serverseitig gefiltert sind und die Seiten-
 * Treffer oben in JS ermittelt werden - stattdessen werden alle Einträge in
 * festgelegter Reihenfolge gerendert und cmdk übernimmt nur Tastatur-Navigation
 * (Pfeiltasten/Enter) und Maus-Auswahl.
 */

/** Icon je Entitätsart - konsistent zu den Sidebar-Icons der Module. */
const TYPE_ICONS: Record<SearchEntityType, typeof LayoutDashboard> = {
	property: Building2,
	unit: DoorOpen,
	tenant: Users,
	lease: FileSignature,
	ticket: Wrench,
	document: FolderOpen,
	owner: UserSquare2,
	hoa: Building2,
	billingPeriod: Calculator,
	economicPlan: Calculator,
	annualStatement: FileText,
	meeting: CalendarDays,
	resolution: Gavel,
	knowledgeArticle: BookOpen,
	template: FileText,
	calendarEvent: CalendarRange,
	account: Landmark,
	bankTransaction: Landmark,
	transaction: Wallet,
	housingCharge: Wallet,
	allocationKey: Scale,
	hoaAllocationKey: Scale,
	user: ShieldCheck,
	mailboxMessage: Inbox,
};

/** Gruppen-Label je Entitätsart (Namespace "search"). */
const TYPE_LABEL_KEYS: Record<SearchEntityType, MessageKey> = {
	property: "search.type.property",
	unit: "search.type.unit",
	tenant: "search.type.tenant",
	lease: "search.type.lease",
	ticket: "search.type.ticket",
	document: "search.type.document",
	owner: "search.type.owner",
	hoa: "search.type.hoa",
	billingPeriod: "search.type.billingPeriod",
	economicPlan: "search.type.economicPlan",
	annualStatement: "search.type.annualStatement",
	meeting: "search.type.meeting",
	resolution: "search.type.resolution",
	knowledgeArticle: "search.type.knowledgeArticle",
	template: "search.type.template",
	calendarEvent: "search.type.calendarEvent",
	account: "search.type.account",
	bankTransaction: "search.type.bankTransaction",
	transaction: "search.type.transaction",
	housingCharge: "search.type.housingCharge",
	allocationKey: "search.type.allocationKey",
	hoaAllocationKey: "search.type.hoaAllocationKey",
	user: "search.type.user",
	mailboxMessage: "search.type.mailboxMessage",
};

/** Icon je Navigationsseite (Schlüssel = href aus src/lib/search-pages.ts). */
const PAGE_ICONS: Record<string, typeof LayoutDashboard> = {
	"/": LayoutDashboard,
	"/liegenschaften": Building2,
	"/einheiten": DoorOpen,
	"/tickets": Wrench,
	"/postfach": Inbox,
	"/dokumente": FolderOpen,
	"/kalender": CalendarRange,
	"/wissen": BookOpen,
	"/mieter": Users,
	"/vertraege": FileSignature,
	"/finanzen": Wallet,
	"/buchhaltung": Landmark,
	"/abrechnung": Calculator,
	"/vorlagen": FileText,
	"/weg": Building2,
	"/weg/eigentuemer": UserSquare2,
	"/weg/eigentumsverhaeltnisse": Users,
	"/weg/verteilerschluessel": Scale,
	"/weg/wirtschaftsplan": Calculator,
	"/weg/jahresabrechnung": FileText,
	"/weg/hausgeld": Wallet,
	"/weg/ruecklage": PiggyBank,
	"/weg/buchhaltung": Landmark,
	"/weg/versammlungen": CalendarDays,
	"/weg/beschluesse": Gavel,
	"/admin/users": ShieldCheck,
	"/admin/logs": ScrollText,
	"/einstellungen": Settings,
	"/einstellungen#allgemein": Settings,
	"/einstellungen#datensicherung": Settings,
	"/einstellungen#integrationen": Settings,
	"/einstellungen#sicherheit": Settings,
};

/** Debounce der Suchanfrage (ms). */
const SEARCH_DEBOUNCE_MS = 200;

/** Maximale Anzahl angezeigter Seiten-Treffer. */
const MAX_PAGE_MATCHES = 8;

export function GlobalSearch({ isAdmin }: { isAdmin: boolean }) {
	const { t } = useI18n();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	// Plattform-abhängige Tastatur-Anzeige im Trigger (macOS: ⌘K, sonst: Strg K).
	const [shortcutLabel, setShortcutLabel] = useState("⌘K");

	useEffect(() => {
		if (!navigator.userAgent.includes("Mac")) setShortcutLabel("Strg K");
	}, []);

	// Globale Tastenkombination Cmd/Ctrl+K öffnet bzw. schließt die Suche.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// Debounced Abruf der Datenbank-Treffer. Beim Schließen des Dialogs und
	// bei zu kurzen Anfragen wird nichts geladen; laufende Anfragen werden
	// über den AbortController abgebrochen (auch beim Query-Wechsel).
	useEffect(() => {
		if (!open) return;
		const trimmed = query.trim();
		if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
			setResults([]);
			setLoading(false);
			setError(false);
			return;
		}
		const controller = new AbortController();
		setLoading(true);
		setError(false);
		const timer = setTimeout(() => {
			fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
				.then(async (response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return (await response.json()) as SearchResponse;
				})
				.then((data) => {
					setResults(data.results ?? []);
				})
				.catch(() => {
					// Abgebrochene Anfragen (Query geändert/Dialog geschlossen)
					// sind kein Fehler - die Nachfolge-Anfrage übernimmt.
					if (controller.signal.aborted) return;
					setResults([]);
					setError(true);
				})
				.finally(() => {
					if (!controller.signal.aborted) setLoading(false);
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [open, query]);

	function handleOpenChange(value: boolean) {
		setOpen(value);
		// Beim Schließen zurücksetzen, damit der nächste Aufruf sauber startet
		// und keine alten Ergebnisse aufblitzen.
		if (!value) {
			setQuery("");
			setResults([]);
			setLoading(false);
			setError(false);
		}
	}

	function navigate(href: string) {
		handleOpenChange(false);
		router.push(href);
	}

	// Navigations-/Einstellungsseiten: lokal gefiltert (Titel + Schlüsselwörter).
	const pageMatches = useMemo<SearchPageEntry[]>(() => {
		const needle = query.trim().toLowerCase();
		if (needle.length < 1) return [];
		return SEARCH_PAGE_ENTRIES.filter((entry) => {
			if (entry.adminOnly && !isAdmin) return false;
			if (t(entry.titleKey).toLowerCase().includes(needle)) return true;
			return (entry.keywords ?? []).some((keyword) => keyword.includes(needle));
		}).slice(0, MAX_PAGE_MATCHES);
	}, [isAdmin, query, t]);

	// Datenbank-Treffer nach Entitätsart gruppieren (die Reihenfolge entspricht
	// der Priorisierung im Repository).
	const groupedResults = useMemo(() => {
		const groups = new Map<SearchEntityType, SearchRow[]>();
		for (const row of results) {
			const existing = groups.get(row.type);
			if (existing) {
				existing.push(row);
			} else {
				groups.set(row.type, [row]);
			}
		}
		return [...groups.entries()];
	}, [results]);

	const trimmedQuery = query.trim();
	const hasAnyMatch = pageMatches.length > 0 || results.length > 0;

	return (
		<>
			{/* Trigger im Sidebar-Kopf: Text und Shortcut blenden im
			    eingeklappten Icon-Modus aus (Muster wie der Logo-Block darüber). */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex w-full items-center gap-2 rounded-md border border-sidebar-border px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
				aria-label={t("search.openButton")}
				title={t("search.openButton")}
			>
				<Search className="size-4 shrink-0" />
				<span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">{t("search.trigger")}</span>
				<kbd className="pointer-events-none shrink-0 rounded border border-sidebar-border px-1 font-mono text-[10px] font-medium group-data-[collapsible=icon]:hidden">
					{shortcutLabel}
				</kbd>
			</button>

			<CommandDialog
				open={open}
				onOpenChange={handleOpenChange}
				title={t("search.dialogTitle")}
				description={t("search.dialogDescription")}
				className="sm:max-w-lg"
			>
				<Command shouldFilter={false}>
					<CommandInput value={query} onValueChange={setQuery} placeholder={t("search.placeholder")} />
					<CommandList className="max-h-[min(60vh,24rem)]">
						{error ? (
							<div className="px-3 py-6 text-center text-sm text-destructive">{t("search.error")}</div>
						) : null}
						{loading && results.length === 0 ? (
							<div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								{t("search.searching")}
							</div>
						) : null}
						{!loading && !error && trimmedQuery.length >= 1 && !hasAnyMatch ? (
							<CommandEmpty>{t("search.noResults", { query: trimmedQuery })}</CommandEmpty>
						) : null}
						{pageMatches.length > 0 ? (
							<CommandGroup heading={t("search.group.pages")}>
								{pageMatches.map((entry) => {
									const Icon = PAGE_ICONS[entry.href] ?? FileText;
									return (
										<CommandItem key={entry.href} value={`page:${entry.href}`} onSelect={() => navigate(entry.href)}>
											<Icon />
											<span className="truncate">{t(entry.titleKey)}</span>
											{entry.subtitleKey ? (
												<span className="ml-auto shrink-0 text-xs text-muted-foreground">{t(entry.subtitleKey)}</span>
											) : null}
										</CommandItem>
									);
								})}
							</CommandGroup>
						) : null}
						{groupedResults.map(([type, rows]) => {
							const Icon = TYPE_ICONS[type];
							return (
								<CommandGroup key={type} heading={t(TYPE_LABEL_KEYS[type])}>
									{rows.map((row) => (
										<CommandItem key={`${row.type}:${row.id}`} value={`${row.type}:${row.id}`} onSelect={() => navigate(row.href)}>
											<Icon />
											<span className="flex min-w-0 flex-1 flex-col">
												<span className="truncate">{row.title}</span>
												{row.subtitle ? <span className="truncate text-xs text-muted-foreground">{row.subtitle}</span> : null}
											</span>
											<CornerDownLeft className="ml-2 shrink-0 opacity-0 group-data-selected/command-item:opacity-100" />
										</CommandItem>
									))}
								</CommandGroup>
							);
						})}
					</CommandList>
					<div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
						<span className="truncate">{t("search.hintKeys")}</span>
						{loading ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
					</div>
				</Command>
			</CommandDialog>
		</>
	);
}
