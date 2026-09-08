"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SettingsTab {
	value: string;
	label: string;
	content: ReactNode;
}

/**
 * Tab-Navigation der Einstellungs-Seite. Der aktive Tab wird mit dem
 * URL-Hash synchronisiert (ersetzt die frühere Anker-Navigation): So ist
 * nach den Seiten-Reloads der einzelnen Karten (z. B. nach dem Speichern
 * der Dropbox- oder KI-Einstellungen) wieder derselbe Bereich geöffnet.
 *
 * Inaktive Inhalte bleiben gemountet (forceMount), damit halb ausgefüllte
 * Formulare beim Tab-Wechsel nicht verloren gehen.
 */
export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
	const [active, setActive] = useState(tabs[0]?.value ?? "");

	// Initialen Tab aus dem URL-Hash lesen - bewusst erst im Effect (serverseitig
	// gibt es keinen Hash, ein abweichender Initialwert würde die Hydration brechen).
	useEffect(() => {
		const fromHash = window.location.hash.replace("#", "");
		if (tabs.some((tab) => tab.value === fromHash)) {
			setActive(fromHash);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function handleChange(value: string): void {
		setActive(value);
		window.history.replaceState(null, "", `#${value}`);
	}

	return (
		<Tabs value={active} onValueChange={handleChange} className="gap-4">
			<TabsList className="h-auto flex-wrap">
				{tabs.map((tab) => (
					<TabsTrigger key={tab.value} value={tab.value} className="px-3 py-1">
						{tab.label}
					</TabsTrigger>
				))}
			</TabsList>
			{tabs.map((tab) => (
				<TabsContent key={tab.value} value={tab.value} forceMount className="space-y-6">
					{tab.content}
				</TabsContent>
			))}
		</Tabs>
	);
}
