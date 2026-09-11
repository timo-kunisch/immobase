"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Auswahl-Option des SearchableSelect. */
export interface SearchableSelectOption {
	/** Formularwert der Option (z. B. die ID des Datensatzes). */
	value: string;
	/** Anzeige- und Suchtext der Option. */
	label: string;
	/** Zusätzliche Suchbegriffe (z. B. Beträge oder Daten), ohne sie sichtbar anzuzeigen. */
	keywords?: string[];
	/** Deaktivierte Option (nicht auswählbar). */
	disabled?: boolean;
	/** Gruppenüberschrift - Optionen mit gleichem group-Wert werden gebündelt (Reihenfolge des ersten Auftretens). */
	group?: string;
}

export interface SearchableSelectProps {
	/** Zur Verfügung stehende Optionen. */
	options: SearchableSelectOption[];
	/** Kontrollierter aktueller Wert; ohne value agiert die Komponente unkontrolliert über defaultValue. */
	value?: string;
	/** Anfangswert im unkontrollierten Modus. */
	defaultValue?: string;
	/** Wird bei jeder Auswahl aufgerufen (kontrolliert wie unkontrolliert). */
	onValueChange?: (value: string) => void;
	/**
	 * Formularfeldname: rendert ein unsichtbares natives select im Komponenten-Baum,
	 * damit FormData-Übermittlung und native Pflichtfeld-Validierung (required)
	 * exakt wie beim klassischen Select funktionieren (Muster wie Radix Select).
	 */
	name?: string;
	/** Pflichtfeld (nur zusammen mit name wirksam, native Validierung). */
	required?: boolean;
	/** Komplett deaktiviert. */
	disabled?: boolean;
	/** DOM-id des Triggers (für Label htmlFor). */
	id?: string;
	/** Platzhalter im Trigger, solange nichts gewählt ist. */
	placeholder?: string;
	/** Platzhalter der Suchbox (Default: i18n common.searchableSelect.searchPlaceholder). */
	searchPlaceholder?: string;
	/** Text, wenn keine Option (mehr) zur Suche passt (Default: i18n common.searchableSelect.noResults). */
	emptyText?: string;
	/** Zusätzliche CSS-Klassen für den Trigger-Button. */
	className?: string;
}

/**
 * Durchsuchbares Auswahl-Feld (Combobox) für dynamische Listen aus der
 * Datenbank (Liegenschaften, Einheiten, Mieter, Eigentümer, Verträge, ...):
 * Der Trigger sieht aus wie ein klassisches Select, öffnet aber ein Popover
 * mit Suchbox (cmdk) - bei vielen Einträgen kann die gewünschte Option
 * getippt werden, statt sie in der Liste zu suchen. Für feste Enum-Listen
 * mit wenigen Optionen (Status, Typen) bleibt es beim klassischen Select.
 */
export function SearchableSelect({
	options,
	value,
	defaultValue,
	onValueChange,
	name,
	required,
	disabled,
	id,
	placeholder,
	searchPlaceholder,
	emptyText,
	className,
}: SearchableSelectProps) {
	const { t } = useI18n();
	const [open, setOpen] = React.useState(false);
	const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
	const contentId = React.useId();

	const isControlled = value !== undefined;
	const selectedValue = isControlled ? value : internalValue;
	const selectedOption = options.find((option) => option.value === selectedValue);

	function handleSelect(nextValue: string) {
		onValueChange?.(nextValue);
		if (!isControlled) setInternalValue(nextValue);
		setOpen(false);
	}

	// Optionen ohne Gruppe + gebündelte Gruppen (in Reihenfolge des ersten Auftretens).
	const ungroupedOptions = options.filter((option) => !option.group);
	const groupedOptions = React.useMemo(() => {
		const groups = new Map<string, SearchableSelectOption[]>();
		for (const option of options) {
			if (!option.group) continue;
			const existing = groups.get(option.group);
			if (existing) {
				existing.push(option);
			} else {
				groups.set(option.group, [option]);
			}
		}
		return [...groups.entries()];
	}, [options]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					id={id}
					role="combobox"
					aria-expanded={open}
					aria-controls={contentId}
					disabled={disabled}
					className={cn(
						"flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
						className
					)}
				>
					<span className={cn("min-w-0 flex-1 truncate text-left", !selectedOption && "text-muted-foreground")}>
						{selectedOption ? selectedOption.label : (placeholder ?? t("common.pleaseSelect"))}
					</span>
					<ChevronDownIcon
						className={cn("pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-180")}
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent id={contentId} className="w-(--radix-popover-trigger-width) p-0" align="start">
				<Command>
					<CommandInput
						placeholder={searchPlaceholder ?? t("common.searchableSelect.searchPlaceholder")}
					/>
					<CommandList>
						<CommandEmpty>{emptyText ?? t("common.searchableSelect.noResults")}</CommandEmpty>
						{ungroupedOptions.map((option) => (
							<SearchableSelectItem
								key={option.value}
								option={option}
								selected={option.value === selectedValue}
								onSelect={handleSelect}
							/>
						))}
						{groupedOptions.map(([group, groupOptions]) => (
							<CommandGroup key={group} heading={group}>
								{groupOptions.map((option) => (
									<SearchableSelectItem
										key={option.value}
										option={option}
										selected={option.value === selectedValue}
										onSelect={handleSelect}
									/>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
			{name ? (
				<select
					name={name}
					required={required}
					disabled={disabled}
					tabIndex={-1}
					aria-hidden
					value={selectedValue}
					onChange={(event) => handleSelect(event.target.value)}
					className="pointer-events-none absolute m-[-1px] h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0_0_0_0)]"
				>
					<option value={selectedValue}>{selectedOption?.label ?? ""}</option>
				</select>
			) : null}
		</Popover>
	);
}

function SearchableSelectItem({
	option,
	selected,
	onSelect,
}: {
	option: SearchableSelectOption;
	selected: boolean;
	onSelect: (value: string) => void;
}) {
	return (
		<CommandItem
			value={option.value}
			keywords={[option.label, ...(option.keywords ?? [])]}
			disabled={option.disabled}
			data-checked={selected || undefined}
			onSelect={() => onSelect(option.value)}
		>
			<span className="min-w-0 break-words">{option.label}</span>
		</CommandItem>
	);
}