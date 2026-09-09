"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Rendert Markdown (v. a. Antworten des KI-Assistenten) mit Tailwind-Styling,
 * abgestimmt auf die Chat-Bubbles (kompakte Abstände, text-sm-Umfeld,
 * Theme-Variablen für Dark Mode).
 *
 * Sicherheit: react-markdown rendert bewusst KEIN rohes HTML aus dem
 * Markdown (kein rehype-raw) - aus Modell-Ausgaben kann so kein XSS/HTML-
 * Injection entstehen. Externe Links öffnen sich über target="_blank" (in der
 * Electron-Shell fängt der Main-Prozess das ab und öffnet den System-Browser).
 * Bilder werden nicht geladen (Offline-App/Datenschutz), stattdessen erscheint
 * ein dezenter Platzhalter mit dem Alt-Text.
 *
 * Plugins: remark-gfm (Tabellen, Aufgabenlisten, Durchgestrichen - die Modelle
 * geben häufig GFM-Tabellen aus), remark-breaks (einzelne Zeilenumbrüche
 * werden als Umbruch dargestellt - Chat-üblich und Verhaltensparität zur
 * früheren Plaintext-Darstellung mit whitespace-pre-wrap).
 */

const components: Components = {
	h1: ({ node: _node, className, ...props }) => (
		<h1 className={cn("mt-3 mb-1 text-base font-semibold first:mt-0", className)} {...props} />
	),
	h2: ({ node: _node, className, ...props }) => (
		<h2 className={cn("mt-3 mb-1 text-[0.95rem] font-semibold first:mt-0", className)} {...props} />
	),
	h3: ({ node: _node, className, ...props }) => (
		<h3 className={cn("mt-2 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
	),
	h4: ({ node: _node, className, ...props }) => (
		<h4 className={cn("mt-2 mb-1 text-sm font-semibold first:mt-0", className)} {...props} />
	),
	p: ({ node: _node, className, ...props }) => <p className={cn("my-2 first:mt-0 last:mb-0", className)} {...props} />,
	ul: ({ node: _node, className, ...props }) => (
		<ul className={cn("my-2 list-disc pl-5 first:mt-0 last:mb-0", className)} {...props} />
	),
	ol: ({ node: _node, className, ...props }) => (
		<ol className={cn("my-2 list-decimal pl-5 first:mt-0 last:mb-0", className)} {...props} />
	),
	li: ({ node: _node, className, ...props }) => <li className={cn("my-0.5", className)} {...props} />,
	a: ({ node: _node, className, ...props }) => (
		<a
			className={cn("underline underline-offset-2 hover:text-primary", className)}
			target="_blank"
			rel="noreferrer noopener"
			{...props}
		/>
	),
	blockquote: ({ node: _node, className, ...props }) => (
		<blockquote
			className={cn("my-2 border-l-2 border-border pl-3 text-muted-foreground italic first:mt-0 last:mb-0", className)}
			{...props}
		/>
	),
	code: ({ node: _node, className, ...props }) => (
		<code
			className={cn("rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em] break-words", className)}
			{...props}
		/>
	),
	// Code-Blöcke: Die [&_code]-Overrides neutralisieren das Inline-Code-
	// Styling innerhalb von pre (Tailwind gibt Varianten-Utilities nach den
	// Basis-Utilities aus - gleiche Spezifität, die spätere Regel gewinnt).
	pre: ({ node: _node, className, ...props }) => (
		<pre
			className={cn(
				"my-2 overflow-x-auto rounded-md bg-background/70 p-2 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit first:mt-0 last:mb-0",
				className
			)}
			{...props}
		/>
	),
	table: ({ node: _node, className, ...props }) => (
		<div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
			<table className={cn("w-full border-collapse text-left text-xs", className)} {...props} />
		</div>
	),
	th: ({ node: _node, className, ...props }) => (
		<th className={cn("border border-border bg-background/50 px-2 py-1 font-semibold", className)} {...props} />
	),
	td: ({ node: _node, className, ...props }) => (
		<td className={cn("border border-border px-2 py-1 align-top", className)} {...props} />
	),
	hr: ({ node: _node, className, ...props }) => <hr className={cn("my-3 border-border", className)} {...props} />,
	strong: ({ node: _node, className, ...props }) => <strong className={cn("font-semibold", className)} {...props} />,
	// Bilder nicht laden (Offline-App, keine externen Requests aus dem Chat) -
	// stattdessen Platzhalter mit Alt-Text/Dateiname.
	img: ({ node: _node, alt }) => <span className="text-muted-foreground italic">[Bild{alt ? `: ${alt}` : ""}]</span>,
};

export function MarkdownContent({ content }: { content: string }) {
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
			{content}
		</ReactMarkdown>
	);
}
