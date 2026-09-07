/**
 * Regeneriert src/data/schema.sql aus den Migrationen
 * (src/data/migrations/). Wird von `npm run schema:dump` aufgerufen und
 * sollte nach jeder neuen Migration laufen (die Konsistenz prüft
 * src/data/schema.test.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import BetterSqlite3 from "better-sqlite3";

import { migrations } from "../src/data/migrations/index.ts";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const db = new BetterSqlite3(":memory:");
for (const migration of migrations) {
	db.exec(migration.up);
}

const rows = db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name").all();

const content =
	"-- Referenz-Gesamtschema von ImmoBase (generiert aus den Migrationen unter\n-- src/data/migrations/ - NICHT händisch editieren; Quelle der Wahrheit sind die Migrationen.\n-- Konsistenz wird durch src/data/schema.test.ts sichergestellt.)\n\n" +
	rows.map((r) => r.sql + ";").join("\n\n") +
	"\n";

fs.writeFileSync(path.join(rootDir, "src/data/schema.sql"), content);
db.close();
console.log("src/data/schema.sql neu geschrieben.");
