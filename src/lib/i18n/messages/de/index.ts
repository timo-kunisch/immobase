/**
 * Zusammenführen aller deutschen Namespace-Dateien zum Gesamt-Dictionary.
 * Neue Namespaces: Datei hier und in ../en/ anlegen und in beide
 * Index-Dateien eintragen.
 */
import { admin } from "./admin";
import { auth } from "./auth";
import { banking } from "./banking";
import { billing } from "./billing";
import { calendar } from "./calendar";
import { chat } from "./chat";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { documents } from "./documents";
import { finances } from "./finances";
import { hoa } from "./hoa";
import { hoaFinance } from "./hoaFinance";
import { hoaMeetings } from "./hoaMeetings";
import { hoaPlan } from "./hoaPlan";
import { hoaStatement } from "./hoaStatement";
import { knowledge } from "./knowledge";
import { leases } from "./leases";
import { nav } from "./nav";
import { postal } from "./postal";
import { properties } from "./properties";
import { settings } from "./settings";
import { setup } from "./setup";
import { templates } from "./templates";
import { tenants } from "./tenants";
import { tickets } from "./tickets";
import { units } from "./units";

export const deMessages = {
	admin,
	auth,
	banking,
	billing,
	calendar,
	chat,
	common,
	dashboard,
	documents,
	finances,
	hoa,
	hoaFinance,
	hoaMeetings,
	hoaPlan,
	hoaStatement,
	knowledge,
	leases,
	nav,
	postal,
	properties,
	settings,
	setup,
	templates,
	tenants,
	tickets,
	units,
};

export type Messages = typeof deMessages;
