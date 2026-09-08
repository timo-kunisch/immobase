# Code-Signing (macOS)

Der Release-Workflow ([workflows/release.yml](workflows/release.yml)) ist für
Signatur + Notarisierung vorbereitet: Sobald die folgenden fünf
Repository-Secrets gesetzt sind (GitHub →
*Settings → Secrets and variables → Actions*), werden die macOS-Pakete
automatisch signiert und notarisiert; ohne sie bleibt alles unsigniert und
der Build läuft trotzdem durch:

| Secret | Inhalt |
| --- | --- |
| `CSC_LINK` | „Developer ID Application"-Zertifikat inkl. privatem Schlüssel, als `.p12` exportiert und base64-kodiert (`base64 -i cert.p12 \| pbcopy`) |
| `CSC_KEY_PASSWORD` | Passwort des `.p12`-Exports |
| `APPLE_ID` | E-Mail der Apple-ID (Entwicklerkonto) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-spezifisches Passwort von [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | 10-stellige Team-ID aus der Apple-Developer-Mitgliedschaft |

Voraussetzung ist ein bezahltes Apple-Developer-Program-Konto; das
Zertifikat wird unter
[developer.apple.com](https://developer.apple.com/account/resources/certificates)
(Typ **Developer ID Application**, CSR aus der Schlüsselbundverwaltung)
oder direkt in Xcode (*Settings → Accounts → Manage Certificates*)
erzeugt. Windows bleibt vorerst unsigniert; ein eigenes
Windows-Zertifikat (OV/EV) wäre ein separater Schritt.

Technische Details zur Umsetzung (selbst angelegte Keychain per
`CSC_KEYCHAIN`, weil der `CSC_LINK`-Pfad von electron-builder auf aktuellen
macOS-Runnern defekt ist) stehen in den Kommentaren von
[workflows/release.yml](workflows/release.yml) und in der
`electron-builder.yml` im Repository-Stamm.
