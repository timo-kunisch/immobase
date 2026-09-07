"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";

import { generateDocumentAction, previewTemplateAction } from "@/app/(app)/vorlagen/actions";
import { initialPreviewState } from "@/app/(app)/vorlagen/preview-state";

type LeaseOption = {
	id: string;
	tenant: { firstName: string; lastName: string };
	unit: { label: string; property: { name: string } };
};

function GenerateSubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <FileDown />}
			PDF erzeugen
		</Button>
	);
}

/**
 * Formular zum Anwenden einer Vorlage auf einen konkreten Mietvertrag:
 * Auswahl des Vertrags löst eine Live-Vorschau (Betreff/Text mit bereits
 * ersetzten Platzhaltern) aus, die der Nutzer vor der endgültigen
 * PDF-Erzeugung noch bearbeiten kann.
 */
export function GenerateDocumentForm({ templateId, leases }: { templateId: string; leases: LeaseOption[] }) {
	const [selectedLeaseId, setSelectedLeaseId] = useState<string>("");
	const [previewState, previewAction, isPreviewPending] = useActionState(previewTemplateAction, initialPreviewState);
	const [generateState, generateAction] = useActionState(generateDocumentAction, initialActionState);

	const previewFormRef = useRef<HTMLFormElement>(null);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");

	// Sobald die Vorschau für den gewählten Vertrag zurückkommt, die
	// editierbaren Felder damit befüllen.
	useEffect(() => {
		if (previewState.body !== undefined) {
			setSubject(previewState.subject ?? "");
			setBody(previewState.body);
		}
	}, [previewState]);

	useEffect(() => {
		if (generateState.success) {
			setSelectedLeaseId("");
			setSubject("");
			setBody("");
		}
	}, [generateState.success]);

	function handleLeaseChange(leaseId: string) {
		setSelectedLeaseId(leaseId);
		// Vorschau-Formular automatisch absenden, sobald ein Vertrag gewählt wurde.
		requestAnimationFrame(() => previewFormRef.current?.requestSubmit());
	}

	return (
		<div className="space-y-4">
			<form ref={previewFormRef} action={previewAction} className="hidden">
				<input type="hidden" name="templateId" value={templateId} />
				<input type="hidden" name="leaseId" value={selectedLeaseId} />
			</form>

			<div className="grid gap-2 sm:max-w-md">
				<Label htmlFor="leaseSelect">Mietvertrag auswählen</Label>
				<Select value={selectedLeaseId} onValueChange={handleLeaseChange}>
					<SelectTrigger id="leaseSelect" className="w-full">
						<SelectValue placeholder="Mietvertrag auswählen" />
					</SelectTrigger>
					<SelectContent>
						{leases.map((lease) => (
							<SelectItem key={lease.id} value={lease.id}>
								{lease.tenant.firstName} {lease.tenant.lastName} – {lease.unit.property.name} ({lease.unit.label})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="text-xs text-muted-foreground">Optional: Ohne Auswahl wird ein allgemeines Schreiben ohne Empfänger-Anschrift und ohne vertragsbezogene Platzhalter erzeugt.</p>
			</div>

			<Card>
				<CardContent className="space-y-4 pt-6">
					<form action={generateAction} className="space-y-4">
						<input type="hidden" name="templateId" value={templateId} />
						<input type="hidden" name="leaseId" value={selectedLeaseId} />

						<div className="grid gap-2">
							<Label htmlFor="subject">Betreff {isPreviewPending ? <Loader2 className="inline size-3 animate-spin" /> : null}</Label>
							<Input id="subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Betreff (optional)" />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="body">Text</Label>
							<Textarea id="body" name="body" value={body} onChange={(event) => setBody(event.target.value)} className="min-h-64" />
							<p className="text-xs text-muted-foreground">Platzhalter wurden bereits durch die Daten des gewählten Mietvertrags ersetzt. Sie können den Text vor der Erzeugung noch anpassen.</p>
						</div>

						{previewState.error ? <p className="text-sm text-destructive">{previewState.error}</p> : null}
						{generateState.error ? <p className="text-sm text-destructive">{generateState.error}</p> : null}
						{generateState.success ? <p className="text-sm text-emerald-600">Das Schreiben wurde erzeugt und gespeichert.</p> : null}

						<div className="flex justify-end">
							<GenerateSubmitButton />
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
