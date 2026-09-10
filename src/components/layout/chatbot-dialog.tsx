"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookMarked, Bot, Loader2, MessageCircle, Paperclip, SendHorizontal, Trash2, TriangleAlert, User, Wrench, X } from "lucide-react";

import { MarkdownContent } from "@/components/layout/markdown-content";
import { PromptTemplatesPanel } from "@/components/layout/prompt-templates-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_FILE_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/ai/attachment-types";
import { CHAT_HISTORY_HARD_LIMIT_CHARS } from "@/lib/ai/chat-limits";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * KI-Assistent (Sprechblase im Sidebar-Footer): Öffnet ein Chatfenster, das
 * gegen den in den Einstellungen konfigurierten OpenAI-kompatiblen Endpunkt
 * läuft (POST /api/chat, siehe src/app/api/chat/route.ts). Das Modell kann
 * über die Werkzeuge des MCP-Servers Daten der Anwendung lesen und ändern.
 * Der Dialog steht allen angemeldeten Nutzern offen (normale Nutzer ohne
 * Administrations-Werkzeuge, siehe Werkzeug-Scope in src/lib/mcp/registry.ts)
 * und ist deaktiviert, solange kein KI-Endpunkt konfiguriert ist.
 * Assistenten-Antworten werden als Markdown gerendert (MarkdownContent in
 * markdown-content.tsx; kein rohes HTML = kein XSS), Nutzer-Nachrichten
 * bleiben reiner Text.
 *
 * Datei-Anhänge (z. B. Excel-Tabellen mit Mietern, PDF-Abrechnungen,
 * Word-/PowerPoint-Dokumente, Bilder, Text-/Code-Dateien) werden als Base64
 * mitgesendet und serverseitig aufbereitet (src/lib/ai/attachments.ts):
 * Text extrahiert bzw. direkt übernommen, Bilder als Vision-Input
 * durchgereicht. Von den Anhängen werden die Metadaten (Name + Größe, nicht
 * der Inhalt) mit der Nutzer-Nachricht im Verlauf gespeichert, sodass
 * sichtbar bleibt, welche Dateien angehängt waren (AttachmentChipList).
 *
 * Über den Buch-Button in der Eingabeleiste lässt sich ein Panel mit
 * Prompt-Vorlagen einblenden (prompt-templates-panel.tsx): lokalisierte
 * Vorlagen ab Werk (src/lib/ai/prompt-templates.ts) plus eigene Vorlagen
 * des Nutzers (Tabelle prompt_templates, Route /api/chat/prompt-templates).
 * Per Klick wird der Vorlagentext ins Eingabefeld übernommen (bei bereits
 * vorhandenem Text mit Leerzeile angehängt).
 *
 * Der Gesprächsverlauf wird serverseitig pro Nutzer persistiert (Tabelle
 * chat_messages, Zugriff über /api/chat/history) und bleibt über das
 * Schließen des Dialogs, Seiten-Neuladen und App-Neustarts hinaus erhalten,
 * bis er manuell gelöscht wird (Papierkorb-Button bzw. die Größen-Warnung).
 * Der KI-Endpunkt bleibt zustandslos: Der gesamte Verlauf wird bei jeder
 * Anfrage mitgesendet - ab CHAT_HISTORY_WARNING_CHARS Zeichen blendet der
 * Dialog eine Warnung zum steigenden Token-Verbrauch ein und empfiehlt das
 * Löschen; ab CHAT_HISTORY_HARD_LIMIT_CHARS Zeichen (harte Grenze, auch
 * serverseitig in /api/chat geprüft) sperrt der Dialog die Eingabe, bis
 * der Verlauf gelöscht wird. Fehlgeschlagene Anfragen werden als farblich
 * markierte Fehler-Nachricht (Rolle "error") im Verlauf festgehalten und
 * bleiben dort bis zum Löschen nachvollziehbar.
 *
 * Schließen während einer laufenden Anfrage: Diese Komponente hängt im
 * Sidebar-Footer des persistenten App-Layouts - der Dialog kann daher
 * jederzeit geschlossen und die App normal weitergenutzt werden, die
 * Anfrage (fetch in handleSend) und der komplette Zustand laufen im
 * Hintergrund weiter; beim erneuten Öffnen ist der aktuelle Stand
 * sichtbar. Wird eine Antwort fertig, WÄHREND der Dialog geschlossen ist,
 * erscheint eine In-App-Benachrichtigung (Karte unten rechts) und ein
 * Hinweispunkt auf dem Sprechblasen-Button (replyNotice) - beides gilt
 * analog für fehlgeschlagene Anfragen und verschwindet beim Öffnen des
 * Chats, beim manuellen Wegklicken bzw. beim Senden der nächsten
 * Nachricht.
 */

interface ToolCallInfo {
	name: string;
	ok: boolean;
}

interface ChatMessage {
	/** "error" = fehlgeschlagene Anfrage (wird farblich markiert dargestellt). */
	role: "user" | "assistant" | "error";
	content: string;
	/** Bei Assistenten-Antworten: die in dieser Runde ausgeführten Werkzeuge. */
	toolCalls?: ToolCallInfo[];
	/** Bei Nutzer-Nachrichten: Metadaten der Datei-Anhänge (Name + Größe). */
	attachments?: AttachmentMeta[];
}

interface AttachmentMeta {
	name: string;
	size: number;
}

interface PendingAttachment {
	name: string;
	size: number;
	dataBase64: string;
}

const MAX_ATTACHMENTS = MAX_ATTACHMENTS_PER_MESSAGE;

/**
 * Ab dieser Verlaufsgröße (Summe der Nachrichten-Zeichen) wird eine Warnung
 * eingeblendet: Der gesamte Verlauf fließt bei jeder Anfrage in den Kontext
 * des KI-Endpunkts (grob ≈ 4 Zeichen pro Token) - 100.000 Zeichen entsprechen
 * rund 25.000 Tokens Mehrverbrauch pro Nachricht.
 */
const CHAT_HISTORY_WARNING_CHARS = 100_000;

/**
 * Maximale Anzahl direkt sichtbarer Werkzeug-Aufrufe unter einer
 * Assistenten-Antwort. Bei Runden mit vielen Aufrufen (Tool-Loop) werden
 * die übrigen hinter einem Aufklapp-Button verborgen, damit der Verlauf
 * lesbar bleibt.
 */
const MAX_VISIBLE_TOOL_CALLS = 3;

/**
 * Liste der in einer Antwort-Runde ausgeführten Werkzeuge (Name + Erfolg/
 * Fehlschlag) unter der Assistenten-Antwort. Zeigt höchstens
 * MAX_VISIBLE_TOOL_CALLS Einträge direkt; ein Button („+N …" / „weniger")
 * klappt die restlichen Aufrufe auf bzw. wieder zu.
 */
function ToolCallList({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
	const { t } = useI18n();
	const [expanded, setExpanded] = useState(false);
	const visibleCalls = expanded ? toolCalls : toolCalls.slice(0, MAX_VISIBLE_TOOL_CALLS);
	const hiddenCount = toolCalls.length - visibleCalls.length;

	return (
		<p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
			<Wrench className="size-3" />
			{visibleCalls.map((call, callIndex) => (
				<span
					key={callIndex}
					className={cn(
						"rounded border px-1 py-0.5 font-mono",
						call.ok ? "border-border" : "border-destructive/50 text-destructive"
					)}
					title={call.ok ? t("chat.toolOk") : t("chat.toolFailed")}
				>
					{call.name}
				</span>
			))}
			{toolCalls.length > MAX_VISIBLE_TOOL_CALLS ? (
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
					title={expanded ? t("chat.showFewerTools") : t("chat.showAllTools", { count: toolCalls.length })}
					className="rounded border border-border px-1 py-0.5 font-mono hover:bg-muted"
				>
					{expanded ? t("chat.showLessLabel") : `+${hiddenCount} …`}
				</button>
			) : null}
		</p>
	);
}

async function fileToBase64(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	// btoa arbeitet auf Binärstrings - chunkweise wandeln (Call-Stack-Limit).
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Anhang-Chips unter einer Nutzer-Nachricht im Verlauf: Name + Größe der
 * an diese Nachricht gehängten Dateien. Nur Metadaten - der Datei-Inhalt
 * wird nicht im Verlauf gespeichert (Hinweis als Tooltip), die Chips sind
 * daher bewusst nicht klickbar.
 */
function AttachmentChipList({ attachments }: { attachments: AttachmentMeta[] }) {
	const { t } = useI18n();
	return (
		<p className="flex flex-wrap items-center justify-end gap-1 text-xs text-muted-foreground">
			{attachments.map((attachment, index) => (
				<span
					key={index}
					className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5"
					title={t("chat.attachmentHistoryTitle")}
				>
					<Paperclip className="size-3" />
					{attachment.name} ({formatBytes(attachment.size)})
				</span>
			))}
		</p>
	);
}

/** Zeichenanzahl mit deutschem Tausendertrennzeichen (für die Größen-Warnung). */
function formatCharCount(count: number): string {
	return new Intl.NumberFormat("de-DE").format(count);
}

export function ChatbotDialog({ aiConfigured }: { aiConfigured: boolean }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [historyLoaded, setHistoryLoaded] = useState(false);
	const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const [clearing, setClearing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Ein-/Ausblenden des Vorlagen-Panels über dem Eingabefeld (Buch-Button
	// in der Eingabeleiste).
	const [templatesOpen, setTemplatesOpen] = useState(false);
	// In-App-Benachrichtigung, wenn eine Antwort bei GESCHLOSSENEM Dialog
	// fertig wird (success) bzw. fehlschlägt (error) - als Karte unten rechts
	// plus Hinweispunkt auf dem Sprechblasen-Button.
	const [replyNotice, setReplyNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	// Spiegelt den Open-State für den asynchronen Abschluss von handleSend:
	// Der dortige Closure sieht den State-Wert vom Sende-Zeitpunkt, nicht ob
	// der Dialog bei Antwort-Eingang noch offen ist.
	const openRef = useRef(false);

	/** Öffnet/schließt den Dialog; beim Öffnen wird eine evtl. vorhandene
	 *  Antwort-Benachrichtigung quittiert (die Antwort ist dann sichtbar). */
	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		openRef.current = nextOpen;
		if (nextOpen) setReplyNotice(null);
	}

	/** Benachrichtigung setzen, sofern der Dialog gerade geschlossen ist. */
	function notifyIfClosed(notice: { kind: "success" | "error"; text: string }) {
		if (!openRef.current) setReplyNotice(notice);
	}

	const enabled = aiConfigured;
	const disabledHint = t("chat.disabledHint");

	// Gesamtlänge des Verlaufs - steuert die Größen-Warnung und die harte
	// Grenze (der komplette Verlauf fließt bei jeder Anfrage in den
	// KI-Kontext).
	const totalHistoryChars = messages.reduce((sum, message) => sum + message.content.length, 0);
	const historyTooLarge = totalHistoryChars >= CHAT_HISTORY_WARNING_CHARS;
	// Harte Grenze erreicht: Eingabe sperren, bis der Verlauf gelöscht wird
	// (die Chat-Route lehnt Nachrichten ab dort ebenfalls ab, HTTP 413).
	const historyHardLimitReached = totalHistoryChars >= CHAT_HISTORY_HARD_LIMIT_CHARS;

	// Gespeicherten Verlauf beim Mount laden (serverseitig pro Nutzer
	// persistiert - bleibt bis zum manuellen Löschen erhalten).
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const response = await fetch("/api/chat/history");
				const data = (await response.json().catch(() => null)) as { messages?: ChatMessage[]; error?: string } | null;
				if (!response.ok || data === null || !Array.isArray(data.messages)) {
					throw new Error(data?.error ?? t("chat.loadFailedHttp", { status: response.status }));
				}
				if (!cancelled) setMessages(data.messages);
			} catch (cause) {
				if (!cancelled) {
					setError(cause instanceof Error ? cause.message : t("chat.loadFailed"));
				}
			} finally {
				if (!cancelled) setHistoryLoaded(true);
			}
		})();
		return () => {
			cancelled = true;
		};
		// t: nur für die Fehlermeldungen; ändert sich praktisch nur beim
		// Sprachwechsel - ein erneutes Laden des Verlaufs ist dann harmlos.
	}, [t]);

	// Beim Öffnen des Dialogs direkt ans Ende (neueste Nachricht) scrollen:
	// Radix unmountet den Dialog-INHALT beim Schließen, der Scroll-Container
	// wird bei jedem Öffnen also frisch gemountet (Startposition wäre sonst
	// oben). Der stabile useCallback-Ref läuft dabei in der Commit-Phase vor
	// dem ersten Paint - kein sichtbares Nach-unten-Springen. (Nicht inline
	// schreiben: Ein neuer Funktions-Ref je Render würde bei JEDEM Render
	// ans Ende zwingen und das Hochscrollen im offenen Dialog verhindern.)
	const setScrollRef = useCallback((element: HTMLDivElement | null) => {
		scrollRef.current = element;
		if (element) element.scrollTop = element.scrollHeight;
	}, []);

	// Bei neuen Nachrichten/laufender Anfrage ans Ende scrollen (solange der
	// Dialog geöffnet ist).
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages, pending]);

	async function handleFilesSelected(fileList: FileList | null): Promise<void> {
		if (!fileList) return;
		setError(null);
		const next = [...attachments];
		for (const file of Array.from(fileList)) {
			if (next.length >= MAX_ATTACHMENTS) {
				setError(t("chat.maxAttachments", { max: MAX_ATTACHMENTS }));
				break;
			}
			if (file.size > MAX_ATTACHMENT_BYTES) {
				setError(
					t("chat.fileTooLarge", { name: file.name, size: formatBytes(file.size), max: formatBytes(MAX_ATTACHMENT_BYTES) })
				);
				continue;
			}
			try {
				next.push({ name: file.name, size: file.size, dataBase64: await fileToBase64(file) });
			} catch {
				setError(t("chat.fileUnreadable", { name: file.name }));
			}
		}
		setAttachments(next);
		// Gleiche Datei erneut auswählbar machen.
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	async function handleSend(): Promise<void> {
		const text = input.trim();
		if (pending || historyHardLimitReached || (!text && attachments.length === 0)) return;

		const userMessage: ChatMessage = {
			role: "user",
			content: text || t("chat.attachmentOnly"),
			// Metadaten der Anhänge direkt in die optimistische Nachricht -
			// dieselben Metadaten persistiert die Chat-Route serverseitig,
			// sodass die Chips auch nach einem Neuladen sichtbar bleiben.
			attachments: attachments.map(({ name, size }) => ({ name, size })),
		};
		const nextMessages = [...messages, userMessage];
		const sentAttachments = attachments.map(({ name, dataBase64 }) => ({ name, dataBase64 }));

		setMessages(nextMessages);
		setInput("");
		setAttachments([]);
		setPending(true);
		setError(null);
		// Eine evtl. noch stehende Benachrichtigung der vorherigen Runde ist
		// ab jetzt überholt (die neue Antwort ersetzt sie in Kürze).
		setReplyNotice(null);

		try {
			// Nur die neue Nachricht senden - der bisherige Verlauf liegt
			// serverseitig (chat_messages) und wird dort ergänzt.
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: userMessage.content,
					attachments: sentAttachments,
				}),
			});
			// Die Antwort kommt normalerweise als JSON - bei unerwarteten
			// Serverfehlern (z. B. Next.js-Fehlerseite) aber als HTML/Text.
			// Erst als Text lesen und tolerant parsen, damit die echte
			// Fehlermeldung sichtbar wird statt eines JSON-Parse-Fehlers.
			const responseText = await response.text();
			let data: { reply?: string; toolCalls?: ToolCallInfo[]; error?: string } | null;
			try {
				data = JSON.parse(responseText) as { reply?: string; toolCalls?: ToolCallInfo[]; error?: string };
			} catch {
				data = null;
			}
			if (!response.ok || data === null) {
				const serverSnippet =
					responseText && !responseText.startsWith("<") ? t("chat.serverResponseSnippet", { snippet: responseText.slice(0, 300) }) : "";
				throw new Error(data?.error ?? `${t("chat.requestFailedHttp", { status: response.status })}${serverSnippet}`);
			}
			setMessages([...nextMessages, { role: "assistant", content: data.reply ?? "", toolCalls: data.toolCalls ?? [] }]);
			// Bei geschlossenem Dialog auf die fertige Antwort hinweisen
			// (Benachrichtigungs-Karte + Hinweispunkt am Button).
			notifyIfClosed({ kind: "success", text: t("chat.replyReady") });
		} catch (cause) {
			// Der Fehlschlag wird Teil des Verlaufs (farblich markierte
			// Fehler-Nachricht). Vom Server verarbeitete Fehler (ChatError/
			// AiClientError) hat die Route bereits serverseitig persistiert;
			// der lokale Eintrag spiegelt denselben Text.
			const errorText = cause instanceof Error ? cause.message : t("chat.requestFailed");
			setMessages([...nextMessages, { role: "error", content: errorText }]);
			// Auch über den Fehlschlag bei geschlossenem Dialog informieren
			// (Text gekürzt, die volle Meldung steht im Verlauf).
			const shortError = errorText.length > 160 ? `${errorText.slice(0, 160)}…` : errorText;
			notifyIfClosed({ kind: "error", text: t("chat.replyFailedPrefix", { message: shortError }) });
		} finally {
			setPending(false);
			textareaRef.current?.focus();
		}
	}

	/**
	 * Übernimmt eine Prompt-Vorlage ins Eingabefeld: Bei leerem Feld wird
	 * der Text gesetzt, bei vorhandenem Text mit Leerzeile angehängt, damit
	 * bereits Getipptes nicht verloren geht. Danach wird das Panel
	 * zugeklappt und der Fokus ins Eingabefeld gesetzt.
	 */
	function handleInsertTemplate(content: string) {
		setInput((current) => (current.trim() ? `${current.trimEnd()}\n\n${content}` : content));
		setTemplatesOpen(false);
		textareaRef.current?.focus();
	}

	/**
	 * Löscht den gesamten Chatverlauf - serverseitig (chat_messages) und
	 * lokal. Bewusst der einzige Weg, den Verlauf zu beenden: Er übersteht
	 * sonst Dialog-Schließen, Neuladen und App-Neustarts.
	 */
	async function handleClearHistory(): Promise<void> {
		if (pending || clearing) return;
		setClearing(true);
		setError(null);
		try {
			const response = await fetch("/api/chat/history", { method: "DELETE" });
			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new Error(data?.error ?? t("chat.deleteFailedHttp", { status: response.status }));
			}
			setMessages([]);
			setAttachments([]);
			setInput("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("chat.deleteFailed"));
		} finally {
			setClearing(false);
			textareaRef.current?.focus();
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{/* Der umschließende span trägt den Titel: Deaktivierte Buttons lösen
			    in manchen Browsern keine Mouse-Events (und damit kein Tooltip)
			    aus. Der innere span verankert den Hinweispunkt für eine
			    ungelesene fertige Antwort (replyNotice) positionsfest am Button. */}
			<span title={enabled ? t("chat.title") : disabledHint}>
				<span className="relative inline-flex">
					<DialogTrigger asChild>
						<Button type="button" variant="ghost" size="icon-sm" disabled={!enabled} aria-label={t("chat.title")}>
							<MessageCircle className="size-4" />
						</Button>
					</DialogTrigger>
					{replyNotice ? (
						<span
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar",
								replyNotice.kind === "error" ? "bg-destructive" : "bg-primary"
							)}
						/>
					) : null}
				</span>
			</span>
			<DialogContent className="flex h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="border-b px-4 py-3">
					<DialogTitle className="flex items-center gap-2">
						<Bot className="size-5" />
						{t("chat.title")}
					</DialogTitle>
					<DialogDescription>{t("chat.description")}</DialogDescription>
				</DialogHeader>

				<div ref={setScrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
					{!historyLoaded && messages.length === 0 ? (
						<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							{t("chat.loadingHistory")}
						</div>
					) : messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
							<Bot className="size-8" />
							<p className="whitespace-pre-line">{t("chat.emptyGreeting")}</p>
							<p className="text-xs">{t("chat.emptyPersistenceHint")}</p>
						</div>
					) : (
						messages.map((message, index) => (
							<div key={index} className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
								{message.role === "assistant" ? <Bot className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
								{message.role === "error" ? <TriangleAlert className="mt-1 size-4 shrink-0 text-destructive" /> : null}
								<div className={cn("max-w-[85%] space-y-1", message.role === "user" ? "text-right" : "text-left")}>
									{/* Assistenten-Antworten kommen als Markdown und werden
									    entsprechend gerendert (kein whitespace-pre-wrap, das würde
									    zwischen den gerenderten Blockelementen Leerzeilen erzeugen);
									    max-w-full begrenzt die Bubble, damit breite Tabellen/
									    Code-Blöcke innerhalb scrollen statt herauszuragen.
									    Fehler-Nachrichten (Rolle "error") sind reiner Text und
									    werden farblich hervorgehoben. */}
									<div
										className={cn(
											"inline-block rounded-lg px-3 py-2 text-left text-sm break-words",
											message.role === "user"
												? "whitespace-pre-wrap bg-primary text-primary-foreground"
												: message.role === "error"
													? "max-w-full border border-destructive/50 bg-destructive/10 whitespace-pre-wrap text-destructive"
													: "max-w-full bg-muted"
										)}
									>
										{message.role === "assistant" ? <MarkdownContent content={message.content} /> : message.content}
									</div>
									{message.toolCalls && message.toolCalls.length > 0 ? (
										<ToolCallList toolCalls={message.toolCalls} />
									) : null}
									{message.attachments && message.attachments.length > 0 ? (
										<AttachmentChipList attachments={message.attachments} />
									) : null}
								</div>
								{message.role === "user" ? <User className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
							</div>
						))
					)}
					{pending ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							{t("chat.aiWorking")}
						</div>
					) : null}
				</div>

				<div className="space-y-2 border-t px-4 py-3">
					{historyHardLimitReached ? (
						<div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" />
							<div className="space-y-1">
								<p className="font-medium">
									{t("chat.hardLimitReached", {
										max: formatCharCount(CHAT_HISTORY_HARD_LIMIT_CHARS),
										current: formatCharCount(totalHistoryChars),
									})}
								</p>
								<p>{t("chat.hardLimitHint")}</p>
								<button
									type="button"
									onClick={() => void handleClearHistory()}
									disabled={pending || clearing}
									className="font-medium underline underline-offset-2 hover:no-underline disabled:pointer-events-none disabled:opacity-50"
								>
									{clearing ? t("chat.clearingHistory") : t("chat.clearHistoryNow")}
								</button>
							</div>
						</div>
					) : historyTooLarge ? (
						<div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" />
							<div className="space-y-1">
								<p className="font-medium">{t("chat.historyLarge", { current: formatCharCount(totalHistoryChars) })}</p>
								<p>{t("chat.historyLargeHint", { max: formatCharCount(CHAT_HISTORY_HARD_LIMIT_CHARS) })}</p>
								<button
									type="button"
									onClick={() => void handleClearHistory()}
									disabled={pending || clearing}
									className="font-medium underline underline-offset-2 hover:no-underline disabled:pointer-events-none disabled:opacity-50"
								>
									{t("chat.clearHistoryNow")}
								</button>
							</div>
						</div>
					) : null}
					{attachments.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{attachments.map((attachment, index) => (
								<span key={index} className="flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs">
									<Paperclip className="size-3" />
									{attachment.name} ({formatBytes(attachment.size)})
									<button
										type="button"
										onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
										aria-label={t("chat.removeAttachment", { name: attachment.name })}
										className="text-muted-foreground hover:text-foreground"
									>
										<X className="size-3" />
									</button>
								</span>
							))}
						</div>
					) : null}

					{error ? <p className="text-sm text-destructive">{error}</p> : null}

					{/* Vorlagen-Panel (eingeblendet über den Buch-Button in der
					    Eingabeleiste): Werk-Vorlagen + eigene Vorlagen, per Klick
					    ins Eingabefeld übernehmbar. */}
					{templatesOpen && !historyHardLimitReached ? <PromptTemplatesPanel onInsert={handleInsertTemplate} /> : null}

					<div className="flex items-end gap-2">
						<input
							ref={fileInputRef}
							type="file"
							multiple
							accept={ACCEPTED_FILE_TYPES}
							className="hidden"
							onChange={(event) => void handleFilesSelected(event.target.files)}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title={t("chat.attachTitle")}
							aria-label={t("chat.attachAria")}
							disabled={pending || historyHardLimitReached || attachments.length >= MAX_ATTACHMENTS}
							onClick={() => fileInputRef.current?.click()}
						>
							<Paperclip className="size-4" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title={t("chat.templates.buttonTitle")}
							aria-label={t("chat.templates.buttonAria")}
							aria-expanded={templatesOpen}
							disabled={pending || historyHardLimitReached}
							onClick={() => setTemplatesOpen((value) => !value)}
							className={templatesOpen ? "bg-muted" : undefined}
						>
							<BookMarked className="size-4" />
						</Button>
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={(event) => setInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									void handleSend();
								}
							}}
							placeholder={historyHardLimitReached ? t("chat.placeholderHardLimit") : t("chat.placeholderDefault")}
							rows={2}
							disabled={pending || historyHardLimitReached}
							className="min-h-10 flex-1 resize-none"
						/>
						<Button
							type="button"
							size="icon-sm"
							title={t("chat.sendTitle")}
							aria-label={t("chat.sendTitle")}
							disabled={pending || historyHardLimitReached || (!input.trim() && attachments.length === 0)}
							onClick={() => void handleSend()}
						>
							{pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title={t("chat.clearTitle")}
							aria-label={t("chat.clearAria")}
							disabled={pending || clearing || messages.length === 0}
							onClick={() => void handleClearHistory()}
						>
							{clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
						</Button>
					</div>
				</div>
			</DialogContent>

			{/* In-App-Benachrichtigung: Eine Antwort ist fertig geworden (bzw.
			    fehlgeschlagen), während der Dialog geschlossen war. Bleibt bis
			    zum Öffnen des Chats, Wegklicken oder der nächsten Nachricht
			    stehen; der Hinweispunkt am Sprechblasen-Button signalisiert
			    denselben Zustand. Kein Toast-Auto-Timeout, damit die Info bei
			    längerer Abwesenheit nicht verloren geht. Liegt als fixed-Karte
			    unten rechts; gerendert als Kind der Dialog-Root (die Root selbst
			    erzeugt kein DOM-Element). */}
			{replyNotice ? (
				<div
					role={replyNotice.kind === "error" ? "alert" : "status"}
					className="fixed right-4 bottom-4 z-50 flex w-80 items-start gap-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
				>
					{replyNotice.kind === "error" ? (
						<TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
					) : (
						<Bot className="mt-0.5 size-4 shrink-0 text-primary" />
					)}
					<div className="min-w-0 flex-1 space-y-1">
						<p className="text-sm font-medium">{t("chat.title")}</p>
						<p className="text-xs break-words text-muted-foreground">{replyNotice.text}</p>
						<button
							type="button"
							onClick={() => handleOpenChange(true)}
							className="text-xs font-medium underline underline-offset-2 hover:no-underline"
						>
							{t("chat.openChat")}
						</button>
					</div>
					<button
						type="button"
						onClick={() => setReplyNotice(null)}
						aria-label={t("chat.closeNotice")}
						title={t("chat.closeNotice")}
						className="shrink-0 text-muted-foreground hover:text-foreground"
					>
						<X className="size-4" />
					</button>
				</div>
			) : null}
		</Dialog>
	);
}
