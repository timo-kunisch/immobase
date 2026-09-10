import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PDFDocumentProxy, PDFPageProxy, RenderParameters } from "pdfjs-dist/types/src/display/api";

/**
 * Offline-OCR für gescannte PDF-Seiten ohne Textebene
 * (src/lib/ai/attachments.ts): Die Seite wird mit pdfjs-dist gerendert
 * (Rasterung über @napi-rs/canvas, eine N-API-Bibliothek - ABI-stabil,
 * daher kein ABI-Rebuild für Electron nötig; pdfjs 4.x erwartet genau
 * diese Bibliothek als optionale Abhängigkeit, siehe deren package.json)
 * und das PNG an tesseract.js (WASM-Build der Tesseract-Engine) übergeben.
 *
 * Vollständig offline: Das deutsche Sprachmodell (deu.traineddata) wird als
 * npm-Paket @tesseract.js-data/deu mitgeliefert und lokal per langPath
 * eingebunden (tesseract.js würde es sonst von einer CDN-URL nachladen).
 * Die Engine läuft in einem worker_thread, den tesseract.js selbst
 * verwaltet (createWorker/terminate je Aufruf - die Worker-Erzeugung ist
 * mit deutlich unter einer Sekunde günstig genug dafür).
 *
 * Alle schweren Abhängigkeiten werden LAZY geladen: Schlägt das Laden fehl
 * (z. B. fehlende Plattform-Binary in einem Paket), wirft der Aufruf
 * OcrEngineError - attachments.ts fällt dann auf die bisherige
 * Fehlermeldung zurück (der Chat selbst bleibt funktionsfähig).
 */

/** Fehlerklasse: Die OCR-Engine (Canvas/tesseract/Sprachdaten) ist nicht verfügbar. */
export class OcrEngineError extends Error {}

/** Render-Skalierung: 2,5 × 72 dpi ≈ 180 dpi - guter Kompromiss aus OCR-Qualität und Tempo. */
const OCR_RENDER_SCALE = 2.5;

/** Sprachmodell-Variante: best_int = LSTM-int8 (kleinste UND genaueste Variante für LSTM_ONLY). */
const TESSDATA_SUBDIR = "4.0.0_best_int";
const OCR_LANGUAGE = "deu";

type NapiCanvasModule = typeof import("@napi-rs/canvas");
type TesseractModule = typeof import("tesseract.js");

let canvasModulePromise: Promise<NapiCanvasModule> | null = null;
let tesseractModulePromise: Promise<TesseractModule> | null = null;

async function loadCanvasModule(): Promise<NapiCanvasModule> {
	canvasModulePromise ??= import("@napi-rs/canvas").catch((error) => {
		canvasModulePromise = null; // Beim nächsten Anhang erneut versuchen.
		throw new OcrEngineError(`@napi-rs/canvas konnte nicht geladen werden: ${error instanceof Error ? error.message : error}`);
	});
	return canvasModulePromise;
}

async function loadTesseractModule(): Promise<TesseractModule> {
	tesseractModulePromise ??= import("tesseract.js").catch((error) => {
		tesseractModulePromise = null;
		throw new OcrEngineError(`tesseract.js konnte nicht geladen werden: ${error instanceof Error ? error.message : error}`);
	});
	return tesseractModulePromise;
}

/**
 * Ermittelt den Dateipfad des mitgelieferten deutschen Sprachmodells
 * (deu.traineddata.gz aus @tesseract.js-data/deu). Wirft OcrEngineError,
 * wenn die Datei nicht auffindbar ist (z. B. Tracing-Lücke im Paket).
 *
 * Auflösung bewusst als Hochlauf über die Vorfahren-Verzeichnisse dieses
 * Moduls (import.meta.url): require.resolve würde vom Turbopack-Bundler
 * zur Build-Zeit statisch ersetzt (literale Bezeichner) bzw. abgelehnt
 * ("expression is too dynamic") und ist damit im Standalone-/Electron-
 * Paket unbrauchbar. Der Hochlauf findet das node_modules in allen drei
 * Laufzeitformen: next dev (Projektroot), Vitest (echter Quellpfad) und
 * Standalone-Build (import.meta.url zeigt auf <standalone>/src/..., der
 * getracete Baum liegt in <standalone>/node_modules).
 */
function resolveTessdataPath(): string {
	const traineddataName = `${OCR_LANGUAGE}.traineddata.gz`;
	const startDir = path.dirname(fileURLToPath(import.meta.url));
	let dir = startDir;
	for (let depth = 0; depth < 15; depth++) {
		const langPath = path.join(dir, "node_modules", "@tesseract.js-data", "deu", TESSDATA_SUBDIR);
		if (fs.existsSync(path.join(langPath, traineddataName))) {
			return langPath;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new OcrEngineError(`Sprachmodell ${traineddataName} nicht gefunden (Hochlauf ab ${startDir})`);
}

/**
 * Rastert eine PDF-Seite in ein PNG (weißer Hintergrund - wichtig für
 * Scans mit Transparenz, damit die OCR nicht auf Schwarz läuft).
 * pdfjs benötigt im Node-Kontext eine Canvas-Factory und für manche
 * Operatoren (Clipping-Pfade u. a.) die Browser-Globals Path2D/DOMMatrix/
 * ImageData - sie werden hier aus @napi-rs/canvas bereitgestellt.
 */
async function renderPdfPageToPng(page: PDFPageProxy, canvasModule: NapiCanvasModule): Promise<Buffer> {
	const { createCanvas, Path2D, DOMMatrix, ImageData } = canvasModule;
	const globals = globalThis as Record<string, unknown>;
	globals.Path2D ??= Path2D;
	globals.DOMMatrix ??= DOMMatrix;
	globals.ImageData ??= ImageData;

	const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
	const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
	const canvasFactory = {
		create(width: number, height: number) {
			const temporary = createCanvas(width, height);
			return { canvas: temporary, context: temporary.getContext("2d") };
		},
		reset(pair: { canvas: { width: number; height: number } }, width: number, height: number) {
			pair.canvas.width = width;
			pair.canvas.height = height;
		},
		destroy(pair: { canvas: { width: number; height: number } }) {
			pair.canvas.width = 0;
			pair.canvas.height = 0;
		},
	};
	// Die Render-Parameter erwarten DOM-Typen (CanvasRenderingContext2D) und
	// kennen canvasFactory gar nicht - die @napi-rs/canvas-Implementierung
	// ist strukturell kompatibel, daher bewusster Gesamt-Cast.
	const renderParameters = {
		canvasContext: canvas.getContext("2d"),
		canvasFactory,
		viewport,
		background: "#FFFFFF",
	} as unknown as RenderParameters;
	await page.render(renderParameters).promise;
	return canvas.toBuffer("image/png");
}

/**
 * OCRt die angegebenen Seiten eines geladenen pdfjs-Dokuments und liefert
 * je Seite den erkannten Text (Seiten ohne erkennbaren Text fehlen in der
 * Map). Ein tesseract-Worker wird für alle Seiten gemeinsam genutzt.
 * Wirft OcrEngineError, wenn die Engine nicht verfügbar ist; Fehler einer
 * einzelnen Seite (z. B. defekte Rasterung) überspringen nur diese Seite.
 */
export async function ocrPdfPages(pdf: PDFDocumentProxy, pageNumbers: number[]): Promise<Map<number, string>> {
	const [canvasModule, tesseractModule] = await Promise.all([loadCanvasModule(), loadTesseractModule()]);
	const langPath = resolveTessdataPath();

	const worker = await tesseractModule
		.createWorker(OCR_LANGUAGE, tesseractModule.OEM.LSTM_ONLY, {
			langPath,
			gzip: true,
			// Kein Cache-Verzeichnis nötig: Die Sprachdaten sind lokal
			// gebündelt; cacheMethod "none" verhindert Schreibzugriffe in
			// den Anwendungsordner.
			cacheMethod: "none",
			logger: () => {},
		})
		.catch((error: unknown) => {
			throw new OcrEngineError(`tesseract-Worker konnte nicht gestartet werden: ${error instanceof Error ? error.message : error}`);
		});

	const results = new Map<number, string>();
	try {
		for (const pageNumber of pageNumbers) {
			try {
				const page = await pdf.getPage(pageNumber);
				const png = await renderPdfPageToPng(page, canvasModule);
				const { data } = await worker.recognize(png);
				const text = data.text.trim();
				if (text) results.set(pageNumber, text);
			} catch (error) {
				console.warn(`[ai] OCR für Seite ${pageNumber} fehlgeschlagen (Seite wird übersprungen):`, error);
			}
		}
	} finally {
		await worker.terminate().catch(() => {});
	}
	return results;
}
