import type { OwnerMeetingStatus, OwnerMeetingType, ResolutionVotingResult } from "@/data/types";

/**
 * Berechnungs-/Ableitungslogik für Eigentümerversammlungen und die
 * Beschluss-Sammlung (§ 24 Abs. 6 WEG). Reine, seiteneffektfreie Funktionen
 * (kein DB-Zugriff), analog zu den übrigen src/lib/hoa-*.ts-Modulen.
 */

/**
 * Berechnet das Ende der einmonatigen Anfechtungsfrist für einen Beschluss
 * (§ 45 Satz 1 WEG: "Die Klage muss innerhalb eines Monats nach der
 * Beschlussfassung erhoben ... werden."). Fristberechnung nach §§ 187
 * Abs. 1, 188 Abs. 2 BGB:
 *  - Die Frist beginnt am Tag NACH der Beschlussfassung (§ 187 Abs. 1 BGB;
 *    der Tag der Beschlussfassung selbst wird nicht mitgezählt).
 *  - Sie endet mit Ablauf desjenigen Tages des folgenden Monats, der durch
 *    seine Zahl dem Tag der Beschlussfassung entspricht (§ 188 Abs. 2
 *    BGB). Hat der Folgemonat diesen Tag nicht (z. B. 31. Januar -> 31.
 *    Februar existiert nicht), endet die Frist mit Ablauf des letzten
 *    Tages jenes Monats (§ 188 Abs. 3 BGB).
 *
 * Gibt den letzten Tag der Frist zurück (00:00 Uhr) - die Frist läuft bis
 * zum ENDE dieses Tages (24:00 Uhr).
 */
export function calculateContestationDeadline(resolvedAt: Date): Date {
	const year = resolvedAt.getFullYear();
	const month = resolvedAt.getMonth();
	const day = resolvedAt.getDate();

	// Letzter Tag des Zielmonats (month + 1, 0-indiziert -> das ist bereits
	// der Folgemonat) - new Date(year, month + 2, 0) liefert den letzten Tag
	// des Monats "month + 1" (0-indiziert), da Tag 0 des Folgemonats der
	// letzte Tag des Vormonats ist.
	const lastDayOfTargetMonth = new Date(year, month + 2, 0).getDate();
	const targetDay = Math.min(day, lastDayOfTargetMonth);

	return new Date(year, month + 1, targetDay);
}

/** Prüft, ob die Anfechtungsfrist eines Beschlusses zu einem bestimmten Zeitpunkt bereits abgelaufen ist. */
export function isContestationDeadlinePassed(contestedUntil: Date, asOf: Date = new Date()): boolean {
	// Die Frist läuft bis zum ENDE des Tages - daher wird contestedUntil auf
	// das Ende des Tages (23:59:59.999) gesetzt, bevor verglichen wird.
	const endOfDeadlineDay = new Date(contestedUntil.getFullYear(), contestedUntil.getMonth(), contestedUntil.getDate(), 23, 59, 59, 999);
	return asOf.getTime() > endOfDeadlineDay.getTime();
}

/**
 * Ermittelt die nächste freie, je WEG fortlaufende Beschlussnummer für die
 * Beschluss-Sammlung (§ 24 Abs. 6 WEG) - einfach die höchste bisher
 * vergebene Nummer + 1 (Start bei 1, falls noch kein Beschluss existiert).
 */
export function nextResolutionSequenceNumber(existingSequenceNumbers: number[]): number {
	if (existingSequenceNumbers.length === 0) return 1;
	return Math.max(...existingSequenceNumbers) + 1;
}

export const ownerMeetingTypeLabels: Record<OwnerMeetingType, string> = {
	ORDINARY: "Ordentliche Versammlung",
	EXTRAORDINARY: "Außerordentliche Versammlung",
	CIRCULATION: "Umlaufbeschluss-Verfahren",
};

export const ownerMeetingStatusLabels: Record<OwnerMeetingStatus, string> = {
	PLANNED: "Geplant",
	INVITED: "Eingeladen",
	HELD: "Durchgeführt",
	MINUTES_FINALIZED: "Protokoll finalisiert",
	CANCELLED: "Abgesagt",
};

export const ownerMeetingStatusStyles: Record<OwnerMeetingStatus, string> = {
	PLANNED: "bg-muted text-muted-foreground",
	INVITED: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	HELD: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
	MINUTES_FINALIZED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export const resolutionVotingResultLabels: Record<ResolutionVotingResult, string> = {
	ACCEPTED: "Angenommen",
	REJECTED: "Abgelehnt",
};

export const resolutionVotingResultStyles: Record<ResolutionVotingResult, string> = {
	ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	REJECTED: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};
