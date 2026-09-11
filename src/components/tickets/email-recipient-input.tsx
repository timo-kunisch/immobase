"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Kontaktvorschlag (Mieter bzw. Eigentümer) für die Empfänger-Eingabe. */
export type EmailContact = {
	name: string;
	email: string;
	kind: "tenant" | "owner";
};

/** Maximal angezeigte Vorschläge (Treffer werden zusätzlich beim Tippen gefiltert). */
const MAX_SUGGESTIONS = 8;

/**
 * Text-Eingabe für E-Mail-Empfänger mit Vervollständigung: Beim Tippen (oder
 * Fokussieren) werden passende Kontakte aus den Stammdaten (Mieter und
 * Eigentümer, durchsucht nach Name UND E-Mail-Adresse) zur Auswahl angeboten;
 * ein Klick übernimmt die Adresse in das Feld. Freie Eingabe bleibt möglich.
 * Tastatur: Pfeiltasten navigieren, Enter übernimmt, Escape schließt.
 */
export function EmailRecipientInput({
	id,
	name,
	defaultValue,
	placeholder,
	contacts,
	required,
}: {
	id?: string;
	name: string;
	defaultValue: string;
	placeholder?: string;
	contacts: EmailContact[];
	required?: boolean;
}) {
	const { t } = useI18n();
	const listboxId = useId();
	const wrapperRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState(defaultValue);
	const [open, setOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(0);

	const suggestions = useMemo(() => {
		const query = value.trim().toLowerCase();
		const matches = query
			? contacts.filter((contact) => contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query))
			: contacts;
		return matches.slice(0, MAX_SUGGESTIONS);
	}, [contacts, value]);

	// form.reset() nach erfolgreichem Versand (siehe TicketReplyForm) feuert ein
	// natives reset-Event - unkontrollierte Felder springen dabei auf ihren
	// defaultValue zurück, das kontrollierte Feld zieht das hier nach.
	useEffect(() => {
		const form = inputRef.current?.form;
		if (!form) {
			return;
		}
		const handleReset = () => setValue(defaultValue);
		form.addEventListener("reset", handleReset);
		return () => form.removeEventListener("reset", handleReset);
	}, [defaultValue]);

	const select = (contact: EmailContact) => {
		setValue(contact.email);
		setOpen(false);
		inputRef.current?.focus();
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (!open || suggestions.length === 0) {
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightedIndex((index) => (index + 1) % suggestions.length);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
		} else if (event.key === "Enter") {
			// Vorschlag übernehmen statt das Formular abzusenden.
			event.preventDefault();
			select(suggestions[highlightedIndex] ?? suggestions[0]);
		} else if (event.key === "Escape") {
			setOpen(false);
		}
	};

	const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
		// Fokus-Wechsel innerhalb des Eingabe-Blocks (z. B. Klick auf einen
		// Vorschlag) darf die Liste nicht schließen.
		if (wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
			return;
		}
		setOpen(false);
	};

	const showList = open && contacts.length > 0;

	return (
		<div ref={wrapperRef} className="relative">
			<Input
				ref={inputRef}
				id={id}
				name={name}
				type="text"
				value={value}
				placeholder={placeholder}
				required={required}
				role="combobox"
				aria-expanded={showList}
				aria-controls={listboxId}
				aria-autocomplete="list"
				aria-activedescendant={showList && suggestions.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
				autoComplete="off"
				onChange={(event) => {
					setValue(event.target.value);
					setOpen(true);
					setHighlightedIndex(0);
				}}
				onFocus={() => setOpen(true)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
			/>
			{showList ? (
				<ul
					id={listboxId}
					role="listbox"
					className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
				>
					{suggestions.length === 0 ? (
						<li className="px-2 py-1.5 text-sm text-muted-foreground">{t("tickets.reply.toContactsEmpty")}</li>
					) : (
						suggestions.map((contact, index) => (
							<li key={contact.email} role="option" aria-selected={index === highlightedIndex} id={`${listboxId}-option-${index}`}>
								<button
									type="button"
									tabIndex={-1}
									// Fokus im Eingabefeld halten, damit die Liste nicht durch den
									// Klick schließt, bevor der Klick verarbeitet wird.
									onMouseDown={(event) => event.preventDefault()}
									onMouseEnter={() => setHighlightedIndex(index)}
									onClick={() => select(contact)}
									className={cn(
										"flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none",
										index === highlightedIndex && "bg-muted text-foreground",
									)}
								>
									<span className="flex w-full items-center justify-between gap-2">
										<span className="truncate font-medium">{contact.name}</span>
										<span className="shrink-0 text-xs text-muted-foreground">
											{contact.kind === "tenant" ? t("tickets.reply.toContactsTenant") : t("tickets.reply.toContactsOwner")}
										</span>
									</span>
									<span className="truncate text-xs text-muted-foreground">{contact.email}</span>
								</button>
							</li>
						))
					)}
				</ul>
			) : null}
		</div>
	);
}
