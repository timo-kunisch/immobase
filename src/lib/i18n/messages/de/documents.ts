/**
 * Namespace "documents" (Deutsch): DMS-Modul /dokumente - Übersichtsseite
 * (alle drei Datei-Quellen), Upload-Dialog, Volltextsuche und die
 * zugehörigen Server Actions (Upload, Löschen, Postversand-Hinweise).
 */
export const documents = {
	title: "Dokumente",
	description: "Digitale Dokumentenablage (DMS).",
	empty: "Noch keine Dokumente vorhanden.",
	emptySearch: 'Keine Dokumente gefunden für "{query}".',
	searchPlaceholder: "Dokumente durchsuchen…",
	"filter.filteredBy": "Gefiltert nach:",
	"table.file": "Datei",
	"table.source": "Quelle",
	"table.linkedTo": "Verknüpft mit",
	// Dokumententypen (DocumentType)
	"category.CONTRACT": "Vertrag",
	"category.INVOICE": "Rechnung",
	"category.FLOORPLAN": "Grundriss",
	"category.OTHER": "Sonstiges",
	// Datei-Quellen (DocumentSourceType)
	"sourceType.DOCUMENT": "Hochgeladenes Dokument",
	"sourceType.GENERATED_DOCUMENT": "Vorlagen-Schreiben",
	"sourceType.TENANT_STATEMENT": "Nebenkostenabrechnung",
	"actions.uploadFile": "Datei hochladen",
	"dialog.uploadTitle": "Dokument hochladen",
	"dialog.uploadDescription": "{types}-Dateien hochladen und optional einer Liegenschaft, Einheit oder einem Mieter zuordnen.",
	"fields.file": "Datei",
	"fields.type": "Dokumententyp",
	"fields.assignmentHint": "Optionale Zuordnung (eine oder mehrere Verknüpfungen möglich):",
	"fields.noTenant": "Keiner",
	"confirm.delete": '"{name}" wirklich löschen?',
	"errors.noFile": "Bitte wählen Sie eine Datei aus.",
	"errors.unsupportedType": "Es werden aktuell nur {types}-Dateien unterstützt.",
	"errors.uploadFailed": "Die Datei konnte nicht hochgeladen werden.",
	"errors.notFound": "Dokument nicht gefunden.",
	"errors.notFoundDetailed": "Das Dokument wurde nicht gefunden.",
	"errors.deleteFailed": "Das Dokument konnte nicht gelöscht werden.",
	"errors.onlyPdf": "Nur PDF-Dokumente können per Post versendet werden.",
	"errors.statementDelete": "Abrechnungs-PDFs können nur über die jeweilige Abrechnungsperiode gelöscht werden.",
};
