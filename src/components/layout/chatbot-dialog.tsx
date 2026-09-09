"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Paperclip, SendHorizontal, Trash2, TriangleAlert, User, Wrench, X } from "lucide-react";

import { MarkdownContent } from "@/components/layout/markdown-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_FILE_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/ai/attachment-types";
import { CHAT_HISTORY_HARD_LIMIT_CHARS } from "@/lib/ai/chat-limits";
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
 * durchgereicht.
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

/** Zeichenanzahl mit deutschem Tausendertrennzeichen (für die Größen-Warnung). */
function formatCharCount(count: number): string {
	return new Intl.NumberFormat("de-DE").format(count);
}

export function ChatbotDialog({ aiConfigured }: { aiConfigured: boolean }) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [historyLoaded, setHistoryLoaded] = useState(false);
	const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const [clearing, setClearing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const enabled = aiConfigured;
	const disabledHint =
		"Der KI-Assistent ist deaktiviert - ein Administrator kann unter Einstellungen → KI-Assistent einen Endpunkt konfigurieren";

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
					throw new Error(data?.error ?? `Der Chat-Verlauf konnte nicht geladen werden (HTTP ${response.status}).`);
				}
				if (!cancelled) setMessages(data.messages);
			} catch (cause) {
				if (!cancelled) {
					setError(cause instanceof Error ? cause.message : "Der Chat-Verlauf konnte nicht geladen werden.");
				}
			} finally {
				if (!cancelled) setHistoryLoaded(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

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
				setError(`Es sind höchstens ${MAX_ATTACHMENTS} Anhänge pro Nachricht erlaubt.`);
				break;
			}
			if (file.size > MAX_ATTACHMENT_BYTES) {
				setError(
					`Die Datei "${file.name}" ist zu groß (${formatBytes(file.size)} - erlaubt sind höchstens ${formatBytes(MAX_ATTACHMENT_BYTES)}).`
				);
				continue;
			}
			try {
				next.push({ name: file.name, size: file.size, dataBase64: await fileToBase64(file) });
			} catch {
				setError(`Die Datei "${file.name}" konnte nicht gelesen werden.`);
			}
		}
		setAttachments(next);
		// Gleiche Datei erneut auswählbar machen.
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	async function handleSend(): Promise<void> {
		const text = input.trim();
		if (pending || historyHardLimitReached || (!text && attachments.length === 0)) return;

		const userMessage: ChatMessage = { role: "user", content: text || "(Datei-Anhang ohne Begleittext)" };
		const nextMessages = [...messages, userMessage];
		const sentAttachments = attachments.map(({ name, dataBase64 }) => ({ name, dataBase64 }));

		setMessages(nextMessages);
		setInput("");
		setAttachments([]);
		setPending(true);
		setError(null);

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
				const serverSnippet = responseText && !responseText.startsWith("<") ? ` Antwort des Servers: ${responseText.slice(0, 300)}` : "";
				throw new Error(data?.error ?? `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).${serverSnippet}`);
			}
			setMessages([...nextMessages, { role: "assistant", content: data.reply ?? "", toolCalls: data.toolCalls ?? [] }]);
		} catch (cause) {
			// Der Fehlschlag wird Teil des Verlaufs (farblich markierte
			// Fehler-Nachricht). Vom Server verarbeitete Fehler (ChatError/
			// AiClientError) hat die Route bereits serverseitig persistiert;
			// der lokale Eintrag spiegelt denselben Text.
			const errorText = cause instanceof Error ? cause.message : "Die Anfrage ist fehlgeschlagen.";
			setMessages([...nextMessages, { role: "error", content: errorText }]);
		} finally {
			setPending(false);
			textareaRef.current?.focus();
		}
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
				throw new Error(data?.error ?? `Der Chat-Verlauf konnte nicht gelöscht werden (HTTP ${response.status}).`);
			}
			setMessages([]);
			setAttachments([]);
			setInput("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Der Chat-Verlauf konnte nicht gelöscht werden.");
		} finally {
			setClearing(false);
			textareaRef.current?.focus();
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{/* Der umschließende span trägt den Titel: Deaktivierte Buttons lösen
			    in manchen Browsern keine Mouse-Events (und damit kein Tooltip)
			    aus. */}
			<span title={enabled ? "KI-Assistent" : disabledHint}>
				<DialogTrigger asChild>
					<Button type="button" variant="ghost" size="icon-sm" disabled={!enabled} aria-label="KI-Assistent">
						<MessageCircle className="size-4" />
					</Button>
				</DialogTrigger>
			</span>
			<DialogContent className="flex h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="border-b px-4 py-3">
					<DialogTitle className="flex items-center gap-2">
						<Bot className="size-5" />
						KI-Assistent
					</DialogTitle>
					<DialogDescription>
						Beantwortet Fragen zu Ihren Daten und kann auf Wunsch Änderungen vornehmen (über die Werkzeuge des
						MCP-Servers). Dateien (PDF, Office-Dokumente, Excel, Bilder, Text/Code) können angehängt werden.
					</DialogDescription>
				</DialogHeader>

				<div ref={setScrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
					{!historyLoaded && messages.length === 0 ? (
						<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Der gespeicherte Chatverlauf wird geladen…
						</div>
					) : messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
							<Bot className="size-8" />
							<p>
								Stellen Sie eine Frage zu Ihren Daten oder bitten Sie um Änderungen,
								<br />
								z. B. „Welche Mietverträge laufen 2026 aus?“ oder „Lege die Mieter aus der angehängten
								Excel-Tabelle an“.
							</p>
							<p className="text-xs">
								Der Verlauf bleibt gespeichert, bis Sie ihn über den Papierkorb-Button löschen.
							</p>
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
										<p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
											<Wrench className="size-3" />
											{message.toolCalls.map((call, callIndex) => (
												<span
													key={callIndex}
													className={cn(
														"rounded border px-1 py-0.5 font-mono",
														call.ok ? "border-border" : "border-destructive/50 text-destructive"
													)}
													title={call.ok ? "Werkzeug erfolgreich ausgeführt" : "Werkzeug-Aufruf fehlgeschlagen"}
												>
													{call.name}
												</span>
											))}
										</p>
									) : null}
								</div>
								{message.role === "user" ? <User className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
							</div>
						))
					)}
					{pending ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" />
							Die KI arbeitet (Werkzeug-Aufrufe können einen Moment dauern)…
						</div>
					) : null}
				</div>

				<div className="space-y-2 border-t px-4 py-3">
					{historyHardLimitReached ? (
						<div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" />
							<div className="space-y-1">
								<p className="font-medium">
									Der Chatverlauf hat die maximale Größe von {formatCharCount(CHAT_HISTORY_HARD_LIMIT_CHARS)} Zeichen
									erreicht ({formatCharCount(totalHistoryChars)} Zeichen).
								</p>
								<p>
									Bevor Sie weitermachen können, muss der Verlauf gelöscht werden - der gesamte Verlauf wird bei
									jeder Nachricht an die KI mitgesendet.
								</p>
								<button
									type="button"
									onClick={() => void handleClearHistory()}
									disabled={pending || clearing}
									className="font-medium underline underline-offset-2 hover:no-underline disabled:pointer-events-none disabled:opacity-50"
								>
									{clearing ? "Verlauf wird gelöscht…" : "Verlauf jetzt löschen"}
								</button>
							</div>
						</div>
					) : historyTooLarge ? (
						<div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" />
							<div className="space-y-1">
								<p className="font-medium">
									Der Chatverlauf ist sehr groß geworden ({formatCharCount(totalHistoryChars)} Zeichen).
								</p>
								<p>
									Da der gesamte Verlauf bei jeder Nachricht an die KI mitgesendet wird, steigt der
									Token-Verbrauch (und damit Kosten und Antwortzeit) spürbar. Es wird empfohlen, den Verlauf
									zu löschen und ein neues Gespräch zu beginnen. Ab{" "}
									{formatCharCount(CHAT_HISTORY_HARD_LIMIT_CHARS)} Zeichen wird das Fortsetzen gesperrt.
								</p>
								<button
									type="button"
									onClick={() => void handleClearHistory()}
									disabled={pending || clearing}
									className="font-medium underline underline-offset-2 hover:no-underline disabled:pointer-events-none disabled:opacity-50"
								>
									Verlauf jetzt löschen
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
										aria-label={`Anhang ${attachment.name} entfernen`}
										className="text-muted-foreground hover:text-foreground"
									>
										<X className="size-3" />
									</button>
								</span>
							))}
						</div>
					) : null}

					{error ? <p className="text-sm text-destructive">{error}</p> : null}

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
							title="Datei anhängen (PDF, Office, Excel, Bilder, Text/Code)"
							aria-label="Datei anhängen"
							disabled={pending || historyHardLimitReached || attachments.length >= MAX_ATTACHMENTS}
							onClick={() => fileInputRef.current?.click()}
						>
							<Paperclip className="size-4" />
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
							placeholder={
								historyHardLimitReached
									? "Maximale Verlaufsgröße erreicht - bitte zuerst den Verlauf löschen."
									: "Nachricht an die KI… (Enter sendet, Umschalt+Enter für Zeilenumbruch)"
							}
							rows={2}
							disabled={pending || historyHardLimitReached}
							className="min-h-10 flex-1 resize-none"
						/>
						<Button
							type="button"
							size="icon-sm"
							title="Senden"
							aria-label="Senden"
							disabled={pending || historyHardLimitReached || (!input.trim() && attachments.length === 0)}
							onClick={() => void handleSend()}
						>
							{pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title="Chatverlauf löschen (neues Gespräch beginnen)"
							aria-label="Chatverlauf löschen"
							disabled={pending || clearing || messages.length === 0}
							onClick={() => void handleClearHistory()}
						>
							{clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
