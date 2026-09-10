"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

/**
 * Toaster der App (einmal im Root-Layout gemountet): zeigt Fehler aus
 * Server Actions als elegante Toasts statt als Inline-Text neben Buttons
 * (siehe src/lib/toast.ts und src/components/action-error-toast.tsx).
 * Bewusst ohne next-themes - die App hat keinen Theming-Umschalter, der
 * helle Look passt zum shadcn-Theme aus globals.css.
 */
export function Toaster(props: ComponentProps<typeof Sonner>) {
	return (
		<Sonner
			theme="light"
			position="bottom-right"
			closeButton
			richColors
			toastOptions={{
				classNames: {
					toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
					title: "group-[.toast]:text-sm group-[.toast]:font-medium",
					description: "group-[.toast]:text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
}