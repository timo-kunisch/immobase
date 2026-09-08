"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Paperclip, SendHorizontal, Trash2, User, Wrench, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_FILE_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/ai/attachment-types";
import { cn } from "@/lib/utils";

/**
 * KI-Assistent (Sprechblase im Sidebar-Footer): Öffnet ein Chatfenster, das
 * gegen den in den Einstellungen konfigurierten OpenAI-kompatiblen Endpunkt
 * läuft (POST /api/chat, siehe src/app/api/chat/route.ts). Das Modell kann
 * über die Werkzeuge des MCP-Servers Daten der Anwendung lesen und ändern -
 * der Dialog steht daher nur Administratoren zur Verfügung und ist
 * deaktiviert, solange kein KI-Endpunkt konfiguriert ist.
 *
 * Datei-Anhänge (z. B. Excel-Tabellen mit Mietern, PDF-Abrechnungen,
 * Word-/PowerPoint-Dokumente, Bilder, Text-/Code-Dateien) werden als Base64
 * mitgesendet und serverseitig aufbereitet (src/lib/ai/attachments.ts):
 * Text extrahiert bzw. direkt übernommen, Bilder als Vision-Input
 * durchgereicht.
 *
 * Der Gesprächsverlauf liegt im State dieser (immer gemounteten) Komponente -
 * Radix unmountet den Dialog-INHALT beim Schließen; so bleibt das Gespräch
 * über das Schließen hinaus erhalten („Neues Gespräch“ setzt es zurück). Der
 * Server ist zustandslos: Der Verlauf wird bei jeder Anfrage vollständig
 * mitgesendet.
 */

interface ToolCallInfo {
	name: string;
	ok: boolean;
}

interface ChatMessage {
	role: "user" | "assistant";
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

export function ChatbotDialog({ aiConfigured, isAdmin }: { aiConfigured: boolean; isAdmin: boolean }) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const enabled = aiConfigured && isAdmin;
	const disabledHint = !isAdmin
		? "Der KI-Assistent steht nur Administratoren zur Verfügung"
		: "Der KI-Assistent ist deaktiviert - ein Administrator kann unter Einstellungen → KI-Assistent einen Endpunkt konfigurieren";

	// Bei neuen Nachrichten/laufender Anfrage ans Ende scrollen.
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
		if (pending || (!text && attachments.length === 0)) return;

		const userMessage: ChatMessage = { role: "user", content: text || "(Datei-Anhang ohne Begleittext)" };
		const nextMessages = [...messages, userMessage];
		const sentAttachments = attachments.map(({ name, dataBase64 }) => ({ name, dataBase64 }));

		setMessages(nextMessages);
		setInput("");
		setAttachments([]);
		setPending(true);
		setError(null);

		try {
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: nextMessages.map(({ role, content }) => ({ role, content })),
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
			setError(cause instanceof Error ? cause.message : "Die Anfrage ist fehlgeschlagen.");
		} finally {
			setPending(false);
			textareaRef.current?.focus();
		}
	}

	function handleReset(): void {
		if (pending) return;
		setMessages([]);
		setAttachments([]);
		setError(null);
		setInput("");
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

				<div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
					{messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
							<Bot className="size-8" />
							<p>
								Stellen Sie eine Frage zu Ihren Daten oder bitten Sie um Änderungen,
								<br />
								z. B. „Welche Mietverträge laufen 2026 aus?“ oder „Lege die Mieter aus der angehängten
								Excel-Tabelle an“.
							</p>
						</div>
					) : (
						messages.map((message, index) => (
							<div key={index} className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}>
								{message.role === "assistant" ? <Bot className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
								<div className={cn("max-w-[85%] space-y-1", message.role === "user" ? "text-right" : "text-left")}>
									<div
										className={cn(
											"inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm",
											message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
										)}
									>
										{message.content}
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
							disabled={pending || attachments.length >= MAX_ATTACHMENTS}
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
							placeholder="Nachricht an die KI… (Enter sendet, Umschalt+Enter für Zeilenumbruch)"
							rows={2}
							disabled={pending}
							className="min-h-10 flex-1 resize-none"
						/>
						<Button
							type="button"
							size="icon-sm"
							title="Senden"
							aria-label="Senden"
							disabled={pending || (!input.trim() && attachments.length === 0)}
							onClick={() => void handleSend()}
						>
							{pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							title="Neues Gespräch beginnen (Verlauf verwerfen)"
							aria-label="Neues Gespräch beginnen"
							disabled={pending || messages.length === 0}
							onClick={handleReset}
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
