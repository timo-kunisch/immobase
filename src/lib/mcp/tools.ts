/**
 * Zentraler Einstiegspunkt der MCP-Werkzeug-Registry: Importiert alle
 * Werkzeug-Module (deren Registrierung als Seiteneffekt beim Import
 * erfolgt) und re-exportiert die Registry-API für den Protokoll-Handler.
 */

import "./tools-rental";
import "./tools-hoa";
import "./tools-system";

export { McpToolError, callTool, listToolDefinitions } from "./registry";
