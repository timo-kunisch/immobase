import { execFile } from "node:child_process";

/**
 * Netzlaufwerk-Erkennung für das Datenverzeichnis.
 *
 * Die SQLite-Datenbank darf NIEMALS auf einem Netzlaufwerk liegen:
 * Advisory-Locks sind über SMB/NFS unzuverlässig und der WAL-Modus benötigt
 * Shared Memory auf einem lokalen Dateisystem - eine Datenbank auf einer
 * Netzwerkfreigabe wird früher oder später KORRUMPIERT. Daher wird der
 * Datenpfad beim Start geprüft und der Start mit einer verständlichen
 * Erklärung abgebrochen, wenn er auf einem Netzlaufwerk liegt.
 *
 * Erkennung:
 * - Windows: UNC-Pfade (\\server\share) direkt; gemappte Laufwerke über
 *   `Get-CimInstance Win32_LogicalDisk` (DriveType 4 = Network).
 * - macOS: Pfade unter /Volumes/<name> werden gegen die Ausgabe von
 *   `mount` geprüft (smbfs/nfs/afpfs/osxfuse/webdav => Netzwerk); zusätzlich
 *   /net und /Network (autofs).
 * - Linux (nur Entwicklung relevant): /proc/mounts-Heuristik (cifs/nfs/smbfs).
 */

export interface NetworkDriveCheckResult {
	ok: boolean;
	reason?: string;
}

const NETWORK_FS_TYPES = new Set([
	"smbfs",
	"nfs",
	"nfs4",
	"afpfs",
	"osxfuse",
	"webdav",
	"cifs",
	"smb3",
	"fuse.sshfs",
	"9p",
]);

function execFileText(command: string, args: string[], timeoutMs = 8000): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
			if (error) resolve(null);
			else resolve(stdout);
		});
	});
}

async function checkWindows(dataDir: string): Promise<NetworkDriveCheckResult> {
	const normalized = dataDir.replace(/\//g, "\\");
	if (normalized.startsWith("\\\\")) {
		return {
			ok: false,
			reason: `Der Datenpfad "${dataDir}" ist ein UNC-Netzwerkpfad (\\\\Server\\Freigabe).`,
		};
	}

	const driveMatch = /^([a-zA-Z]):\\/.exec(normalized);
	if (driveMatch) {
		const drive = `${driveMatch[1].toUpperCase()}:`;
		// DriveType: 2 = Removable, 3 = Local Disk, 4 = Network Drive, ...
		const output = await execFileText("powershell", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			`(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${drive}'").DriveType`,
		]);
		if (output !== null && output.trim() === "4") {
			return {
				ok: false,
				reason: `Der Datenpfad liegt auf dem Laufwerk ${drive} - einem per Netzwerk gemappten Laufwerk.`,
			};
		}
		// Wenn PowerShell nichts liefert (z. B. sehr alte Systeme), konservativ
		// NICHT blockieren - lokale Laufwerke sind der Regelfall.
	}
	return { ok: true };
}

async function checkMacOS(dataDir: string): Promise<NetworkDriveCheckResult> {
	if (dataDir.startsWith("/net/") || dataDir.startsWith("/Network/")) {
		return { ok: false, reason: `Der Datenpfad "${dataDir}" liegt in einem automatisch eingehängten Netzwerk-Verzeichnis.` };
	}
	if (!dataDir.startsWith("/Volumes/")) return { ok: true };

	// Mountpunkt bestimmen: /Volumes/<name>[/...]
	const parts = dataDir.split("/");
	const mountPoint = `/${parts[1]}/${parts[2]}`;
	const mountOutput = await execFileText("mount", []);
	if (mountOutput) {
		// Zeilenformat: "//server/share on /Volumes/share (smbfs, ...)"
		const line = mountOutput.split("\n").find((l) => l.includes(` on ${mountPoint} `) || l.includes(` on ${mountPoint} (`));
		if (line) {
			const fsMatch = /\(([^,)]+)/.exec(line);
			const fsType = fsMatch?.[1]?.trim().toLowerCase();
			if (fsType && NETWORK_FS_TYPES.has(fsType)) {
				return {
					ok: false,
					reason: `Der Datenpfad "${dataDir}" liegt auf "${mountPoint}" - einem Netzwerk-Volume (Dateisystem: ${fsType}).`,
				};
			}
		}
	}
	return { ok: true };
}

async function checkLinux(dataDir: string): Promise<NetworkDriveCheckResult> {
	const fs = await import("node:fs");
	try {
		const mounts = fs.readFileSync("/proc/mounts", "utf8");
		// Längsten passenden Mountpunkt suchen.
		let best: { point: string; type: string } | null = null;
		for (const line of mounts.split("\n")) {
			const fields = line.split(" ");
			if (fields.length < 3) continue;
			const [, point, type] = fields;
			if (dataDir === point || dataDir.startsWith(point + "/")) {
				if (!best || point.length > best.point.length) best = { point, type };
			}
		}
		if (best && NETWORK_FS_TYPES.has(best.type.toLowerCase())) {
			return {
				ok: false,
				reason: `Der Datenpfad "${dataDir}" liegt auf einem Netzwerk-Dateisystem (${best.type}, eingehängt an ${best.point}).`,
			};
		}
	} catch {
		// /proc/mounts nicht lesbar - nicht blockieren.
	}
	return { ok: true };
}

/**
 * Prüft, ob das Datenverzeichnis auf einem Netzlaufwerk liegt. `ok: false`
 * MUSS zum Abbruch mit Erklärung führen (siehe Dateikopf).
 */
export async function checkDataDirNotOnNetworkDrive(dataDir: string): Promise<NetworkDriveCheckResult> {
	switch (process.platform) {
		case "win32":
			return checkWindows(dataDir);
		case "darwin":
			return checkMacOS(dataDir);
		default:
			return checkLinux(dataDir);
	}
}
