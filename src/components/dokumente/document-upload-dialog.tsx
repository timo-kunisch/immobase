"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";

import { uploadDocumentAction } from "@/app/(app)/dokumente/actions";
import { ALLOWED_DOCUMENT_ACCEPT, ALLOWED_DOCUMENT_TYPES_LABEL } from "@/app/(app)/dokumente/upload-constraints";
import type { Property, Tenant, Unit } from "@/data/types";

const typeLabels: Record<string, string> = {
	CONTRACT: "Vertrag",
	INVOICE: "Rechnung",
	FLOORPLAN: "Grundriss",
	OTHER: "Sonstiges",
};

export function DocumentUploadDialog({ properties, units, tenants }: { properties: Property[]; units: Unit[]; tenants: Tenant[] }) {
	const [open, setOpen] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const [state, formAction, isPending] = useActionState(uploadDocumentAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
			formRef.current?.reset();
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button">
					<Upload />
					Datei hochladen
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction} ref={formRef}>
					<DialogHeader>
						<DialogTitle>Dokument hochladen</DialogTitle>
						<DialogDescription>{ALLOWED_DOCUMENT_TYPES_LABEL}-Dateien hochladen und optional einer Liegenschaft, Einheit oder einem Mieter zuordnen.</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="file">Datei *</Label>
							<input
								id="file"
								name="file"
								type="file"
								required
								accept={ALLOWED_DOCUMENT_ACCEPT}
								className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="type">Dokumententyp</Label>
							<Select name="type" defaultValue="OTHER">
								<SelectTrigger id="type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(typeLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<p className="text-xs text-muted-foreground">Optionale Zuordnung (eine oder mehrere Verknüpfungen möglich):</p>

						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="propertyId">Liegenschaft</Label>
								<Select name="propertyId" defaultValue="none">
									<SelectTrigger id="propertyId" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Keine</SelectItem>
										{properties.map((property) => (
											<SelectItem key={property.id} value={property.id}>
												{property.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="unitId">Einheit</Label>
								<Select name="unitId" defaultValue="none">
									<SelectTrigger id="unitId" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Keine</SelectItem>
										{units.map((unit) => (
											<SelectItem key={unit.id} value={unit.id}>
												{unit.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="tenantId">Mieter</Label>
								<Select name="tenantId" defaultValue="none">
									<SelectTrigger id="tenantId" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Keiner</SelectItem>
										{tenants.map((tenant) => (
											<SelectItem key={tenant.id} value={tenant.id}>
												{tenant.firstName} {tenant.lastName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Hochladen
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
