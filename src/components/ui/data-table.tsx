"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Filter, FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/provider";
import { buildPageNumbers } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Generische, clientseitige Datentabelle mit Spalten-Sortierung,
 * Spalten-Filterung und optionaler Client-Pagination.
 *
 * Alle Listen-Tabellen der App nutzen diese Komponente über eine dünne,
 * modul-spezifische Client-Komponente (Spalten-Definition + Zell-Renderer);
 * die Server-Seite lädt die Zeilen und übergibt sie als serialisierbare Props.
 * Sortierung/Filterung laufen bewusst im Browser (Desktop-App, lokale
 * SQLite-Datenmengen) - serverseitige Query-Filter (z. B. `?propertyId=`)
 * bleiben davon unberührt und wirken als Vorfilter.
 */

/** Auswahloption eines Select-Filters (Wert + übersetztes Label). */
export interface DataTableFilterOption {
	value: string;
	label: string;
}

/** Filter-Konfiguration einer Spalte: Freitext oder Auswahlliste. */
export type DataTableColumnFilter<T> =
	| { type: "text"; value: (row: T) => string | null | undefined }
	| { type: "select"; value: (row: T) => string | null | undefined; options: DataTableFilterOption[] };

/** Spalten-Definition der DataTable. */
export interface DataTableColumn<T> {
	/** Eindeutige Spalten-Kennung (React-Key, Sort-/Filter-Zuordnung). */
	key: string;
	/** Überschriften-Text (bereits übersetzt). */
	header: React.ReactNode;
	/** Rechtsbündige Ausrichtung (Beträge, Zahlen). */
	align?: "left" | "right";
	/** Zusätzliche Klassen für die Kopfzelle. */
	headClassName?: string;
	/** Zusätzliche Klassen für alle Zellen der Spalte. */
	cellClassName?: string;
	/**
	 * Sortier-Wert-Accessor: Zahlen werden numerisch verglichen, Strings per
	 * localeCompare (de, numerisch, case-insensitiv) - ISO-Datumswerte
	 * sortieren dadurch korrekt. `null`/`undefined` sortieren immer ans Ende.
	 * Ohne Accessor ist die Spalte nicht sortierbar.
	 */
	sortValue?: (row: T) => string | number | null | undefined;
	/** Filter-Konfiguration; ohne Angabe ist die Spalte nicht filterbar. */
	filter?: DataTableColumnFilter<T>;
	/** Zell-Renderer. */
	cell: (row: T) => React.ReactNode;
}

type SortDirection = "asc" | "desc";

export interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	rows: T[];
	/** Stabiler React-Key je Zeile. */
	rowKey: (row: T) => string;
	/** Optionales HTML-id-Attribut je Zeile (Anchor-Links `#<typ>-<id>`). */
	rowId?: (row: T) => string | undefined;
	/** Zusätzliche Klassen je Zeile. */
	rowClassName?: (row: T) => string | undefined;
	/**
	 * Client-Pagination mit dieser Seitengröße (z. B. 50). Ohne Angabe werden
	 * alle Zeilen angezeigt. Filter-/Sortierungswechsel springen auf Seite 1.
	 */
	pageSize?: number;
}

/** Vergleich zweier Sortier-Werte: Zahlen numerisch, Strings localeCompare, null zuletzt. */
function compareValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
	if (a == null && b == null) return 0;
	// Null/undefined landen unabhängig von der Sortierrichtung immer am Ende.
	if (a == null) return 1;
	if (b == null) return -1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b), "de", { numeric: true, sensitivity: "base" });
}

export function DataTable<T>({ columns, rows, rowKey, rowId, rowClassName, pageSize }: DataTableProps<T>) {
	const { t } = useI18n();
	const [sortKey, setSortKey] = React.useState<string | null>(null);
	const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
	const [filters, setFilters] = React.useState<Record<string, string>>({});
	const [page, setPage] = React.useState(1);

	const hasActiveFilters = Object.values(filters).some((value) => value !== "");

	const toggleSort = (key: string) => {
		if (sortKey !== key) {
			setSortKey(key);
			setSortDirection("asc");
		} else if (sortDirection === "asc") {
			setSortDirection("desc");
		} else {
			// Dritter Klick: ursprüngliche Reihenfolge wiederherstellen.
			setSortKey(null);
			setSortDirection("asc");
		}
	};

	const setFilter = (key: string, value: string) => {
		setFilters((previous) => ({ ...previous, [key]: value }));
	};

	const resetFilters = () => {
		setFilters({});
	};

	// Filter- oder Sortierungswechsel: zurück auf die erste Seite.
	React.useEffect(() => {
		setPage(1);
	}, [filters, sortKey, sortDirection]);

	const filteredRows = React.useMemo(() => {
		const activeColumns = columns.filter((column) => column.filter && filters[column.key]);
		if (activeColumns.length === 0) return rows;
		return rows.filter((row) =>
			activeColumns.every((column) => {
				const filter = column.filter!;
				const raw = filter.value(row);
				const cellValue = (raw ?? "").toString();
				if (filter.type === "select") {
					return cellValue === filters[column.key];
				}
				return cellValue.toLowerCase().includes(filters[column.key].toLowerCase());
			}),
		);
	}, [columns, rows, filters]);

	const sortedRows = React.useMemo(() => {
		if (!sortKey) return filteredRows;
		const column = columns.find((candidate) => candidate.key === sortKey);
		if (!column?.sortValue) return filteredRows;
		const sorted = [...filteredRows].sort((a, b) => compareValues(column.sortValue!(a), column.sortValue!(b)));
		return sortDirection === "asc" ? sorted : sorted.reverse();
	}, [filteredRows, columns, sortKey, sortDirection]);

	const totalPages = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
	const currentPage = Math.min(page, totalPages);
	const visibleRows = pageSize ? sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sortedRows;

	const entriesLabel = t(
		rows.length === 1 ? "common.dataTable.entry.one" : "common.dataTable.entry.other",
		{ count: rows.length },
	);

	const rangeFrom = sortedRows.length === 0 ? 0 : (currentPage - 1) * (pageSize ?? sortedRows.length) + 1;
	const rangeTo = pageSize ? Math.min(currentPage * pageSize, sortedRows.length) : sortedRows.length;

	return (
		<div className="w-full">
			{hasActiveFilters ? (
				<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
					<p className="text-xs text-muted-foreground">
						{t("common.dataTable.filteredCount", { count: filteredRows.length, total: rows.length })} {entriesLabel}
					</p>
					<Button variant="ghost" size="sm" onClick={resetFilters}>
						<FilterX className="size-4" />
						{t("common.resetFilters")}
					</Button>
				</div>
			) : null}

			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((column) => {
							const isSorted = sortKey === column.key;
							return (
								<TableHead
									key={column.key}
									aria-sort={isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
									className={cn(column.align === "right" && "text-right", column.headClassName)}
								>
									<div className={cn("flex items-center gap-1", column.align === "right" && "justify-end")}>
										{column.sortValue ? (
											<button
												type="button"
												onClick={() => toggleSort(column.key)}
												title={t("common.dataTable.sort")}
												className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-foreground hover:underline"
											>
												{column.header}
												{isSorted ? (
													sortDirection === "asc" ? (
														<ArrowUp className="size-3.5" />
													) : (
														<ArrowDown className="size-3.5" />
													)
												) : (
													<ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
												)}
											</button>
										) : (
											column.header
										)}
										{column.filter ? <ColumnFilterButton column={column} filters={filters} onFilterChange={setFilter} /> : null}
									</div>
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody>
					{visibleRows.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
								{t("common.dataTable.noMatches")}
							</TableCell>
						</TableRow>
					) : (
						visibleRows.map((row) => (
							<TableRow key={rowKey(row)} id={rowId?.(row)} className={rowClassName?.(row)}>
								{columns.map((column) => (
									<TableCell key={column.key} className={cn(column.align === "right" && "text-right", column.cellClassName)}>
										{column.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>

			{pageSize && totalPages > 1 ? (
				<div className="flex flex-col gap-2 border-t px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs text-muted-foreground">
						{t("common.dataTable.showingRange", { from: rangeFrom, to: rangeTo, total: sortedRows.length })}
					</p>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon-sm"
							disabled={currentPage <= 1}
							onClick={() => setPage(currentPage - 1)}
							aria-label={t("common.pagination.previous")}
						>
							<ChevronLeft />
						</Button>
						{buildPageNumbers(currentPage, totalPages).map((entry, index) =>
							entry === "ellipsis" ? (
								<span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
									…
								</span>
							) : entry === currentPage ? (
								<Button key={entry} variant="default" size="icon-sm" aria-current="page" disabled>
									{entry}
								</Button>
							) : (
								<Button key={entry} variant="outline" size="icon-sm" onClick={() => setPage(entry)}>
									{entry}
								</Button>
							),
						)}
						<Button
							variant="outline"
							size="icon-sm"
							disabled={currentPage >= totalPages}
							onClick={() => setPage(currentPage + 1)}
							aria-label={t("common.pagination.next")}
						>
							<ChevronRight />
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}

/** Filter-Button im Spaltenkopf (Popover mit Textfeld oder Auswahlliste). */
function ColumnFilterButton<T>({
	column,
	filters,
	onFilterChange,
}: {
	column: DataTableColumn<T>;
	filters: Record<string, string>;
	onFilterChange: (key: string, value: string) => void;
}) {
	const { t } = useI18n();
	const filter = column.filter!;
	const value = filters[column.key] ?? "";
	const isActive = value !== "";

	if (filter.type === "text") {
		return (
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						title={t("common.dataTable.filter")}
						aria-label={t("common.dataTable.filter")}
						className={cn(
							"inline-flex size-6 cursor-pointer items-center justify-center rounded-sm hover:bg-accent",
							isActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground",
						)}
					>
						<Filter className="size-3.5" />
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-56 p-2">
					<Input
						autoFocus
						value={value}
						placeholder={t("common.dataTable.filterPlaceholder")}
						onChange={(event) => onFilterChange(column.key, event.target.value)}
					/>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					title={t("common.dataTable.filter")}
					aria-label={t("common.dataTable.filter")}
					className={cn(
						"inline-flex size-6 cursor-pointer items-center justify-center rounded-sm hover:bg-accent",
						isActive ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground",
					)}
				>
					<Filter className="size-3.5" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-56 p-1">
				<div className="max-h-72 overflow-y-auto">
					<FilterOptionRow
						label={t("common.all")}
						selected={!isActive}
						onSelect={() => onFilterChange(column.key, "")}
					/>
					{filter.options.map((option) => (
						<FilterOptionRow
							key={option.value}
							label={option.label}
							selected={isActive && value === option.value}
							onSelect={() => onFilterChange(column.key, option.value)}
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** Eine Zeile der Select-Filter-Auswahlliste (inkl. Häkchen für die aktive Wahl). */
function FilterOptionRow({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
		>
			<span className="truncate">{label}</span>
			{selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
		</button>
	);
}
