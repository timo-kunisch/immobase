import { migration0001 } from "./0001_init.ts";
import { migration0002 } from "./0002_app_settings.ts";
import type { Migration } from "../migrate.ts";

/**
 * Geordnete Liste aller Migrationen. `version` muss lückenlos aufsteigend
 * bei 1 beginnen; `PRAGMA user_version` speichert die zuletzt angewendete
 * Version. Neue Schema-Änderungen werden als neue Datei `NNNN_name.ts`
 * angehängt (niemals bestehende Migrationen editieren).
 */
export const migrations: Migration[] = [migration0001, migration0002];
