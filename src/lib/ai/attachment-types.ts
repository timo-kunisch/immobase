/**
 * Geteilte Konstanten für Datei-Anhänge des KI-Chats - bewusst OHNE
 * Node-Abhängigkeiten (kein exceljs/pdfjs/jszip), damit sowohl der
 * Server (src/lib/ai/attachments.ts, src/app/api/chat/route.ts) als auch
 * der Client (src/components/layout/chatbot-dialog.tsx) sie importieren
 * können.
 */

/** Maximale Anzahl Anhänge je Nachricht. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** Maximale Rohgröße je Anhang (nach Base64-Dekodierung). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Base64 kodiert ~4/3 der Rohgröße; 14 MB ≈ 10 MB Rohdaten. */
export const MAX_ATTACHMENT_BASE64_CHARS = 14 * 1024 * 1024;

/** Text-/Datendateien: Inhalt wird direkt als Text übernommen. */
export const TEXT_ATTACHMENT_EXTENSIONS = [
	"csv",
	"tsv",
	"txt",
	"md",
	"json",
	"xml",
	"log",
	"yaml",
	"yml",
	"toml",
	"ini",
	"cfg",
	"conf",
	"env",
	"html",
	"htm",
	"css",
	"scss",
	"svg",
	"sql",
	"js",
	"mjs",
	"cjs",
	"jsx",
	"ts",
	"tsx",
	"py",
	"java",
	"c",
	"h",
	"cpp",
	"hpp",
	"cs",
	"php",
	"rb",
	"go",
	"rs",
	"swift",
	"kt",
	"sh",
	"ps1",
	"bat",
	"rtf",
	"ics",
	"vcf",
	"tex",
	"diff",
	"patch",
] as const;

/** Excel-Arbeitsmappen: werden via exceljs in Semikolon-CSV umgewandelt. */
export const EXCEL_ATTACHMENT_EXTENSIONS = ["xlsx", "xlsm", "xltx", "xltm"] as const;

/** Weitere Office-Formate (ZIP-basiert): Textextraktion aus dem XML-Inhalt via jszip. */
export const OFFICE_ATTACHMENT_EXTENSIONS = ["docx", "pptx", "odt", "ods", "odp"] as const;

/** PDF: Textextraktion via pdfjs-dist. */
export const PDF_ATTACHMENT_EXTENSIONS: readonly string[] = ["pdf"];

/** Bilder: werden dem Modell als Vision-Input (image_url, Base64-Data-URL) übergeben. */
export const IMAGE_ATTACHMENT_MIME_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
};

/** Alle unterstützten Dateiendungen (für die accept-Liste des Datei-Dialogs). */
export const ALL_ATTACHMENT_EXTENSIONS: string[] = [
	...TEXT_ATTACHMENT_EXTENSIONS,
	...EXCEL_ATTACHMENT_EXTENSIONS,
	...OFFICE_ATTACHMENT_EXTENSIONS,
	...PDF_ATTACHMENT_EXTENSIONS,
	...Object.keys(IMAGE_ATTACHMENT_MIME_TYPES),
];

/** Wert für das accept-Attribut des <input type="file"> im Chat-Dialog. */
export const ACCEPTED_FILE_TYPES = ALL_ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(",");

/** Kurze, nutzerfreundliche Aufzählung der unterstützten Typen (Fehlermeldungen/Hinweise). */
export const SUPPORTED_TYPES_HINT =
	"PDF, Word/PowerPoint/OpenDocument (.docx, .pptx, .odt, .ods, .odp), Excel (.xlsx), Bilder (.png, .jpg, .gif, .webp) sowie Text-/Datendateien (.csv, .txt, .md, .json, .xml, .log, Code-Dateien u. a.)";
