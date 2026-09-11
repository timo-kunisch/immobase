import { migration0001 } from "./0001_init.ts";
import { migration0002 } from "./0002_app_settings.ts";
import { migration0003 } from "./0003_audit_log.ts";
import { migration0004 } from "./0004_calendar_events.ts";
import { migration0005 } from "./0005_knowledge_base.ts";
import { migration0006 } from "./0006_ticket_messages.ts";
import { migration0007 } from "./0007_chat_messages.ts";
import { migration0008 } from "./0008_prompt_templates.ts";
import { migration0009 } from "./0009_chat_message_attachments.ts";
import { migration0010 } from "./0010_rental_custom_allocation_keys.ts";
import { migration0011 } from "./0011_bank_accounts.ts";
import { migration0012 } from "./0012_calendar_event_times.ts";
import { migration0013 } from "./0013_hoa_statement_banking.ts";
import type { Migration } from "../migrate.ts";

/**
 * Geordnete Liste aller Migrationen. `version` muss lückenlos aufsteigend
 * bei 1 beginnen; `PRAGMA user_version` speichert die zuletzt angewendete
 * Version. Neue Schema-Änderungen werden als neue Datei `NNNN_name.ts`
 * angehängt (niemals bestehende Migrationen editieren).
 */
export const migrations: Migration[] = [
	migration0001,
	migration0002,
	migration0003,
	migration0004,
	migration0005,
	migration0006,
	migration0007,
	migration0008,
	migration0009,
	migration0010,
	migration0011,
	migration0012,
	migration0013,
];
