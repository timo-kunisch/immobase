import type { Migration } from "../migrate.ts";

/**
 * 0001_init - initiales Gesamtschema.
 *
 * Hinweis: Booleans werden als `integer DEFAULT 0/1` (kanonische
 * SQLite-Literale) angelegt; das Mapping 0/1 <-> boolean erfolgt
 * anwendungsseitig im Repository-Layer (src/data/helpers.ts).
 */
export const migration0001: Migration = {
	version: 1,
	name: "init",
	up: `
CREATE TABLE properties (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	street text NOT NULL,
	zip_code text NOT NULL,
	city text NOT NULL,
	country text DEFAULT 'Deutschland' NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE units (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	label text NOT NULL,
	living_space real,
	rooms real,
	floor text,
	co_ownership_share real,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX units_property_id_idx ON units (property_id);

CREATE TABLE tenants (
	id text PRIMARY KEY NOT NULL,
	first_name text NOT NULL,
	last_name text NOT NULL,
	email text,
	phone text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE leases (
	id text PRIMARY KEY NOT NULL,
	unit_id text NOT NULL,
	tenant_id text NOT NULL,
	start_date text NOT NULL,
	end_date text,
	cold_rent text NOT NULL,
	service_charges text NOT NULL,
	number_of_occupants integer DEFAULT 1 NOT NULL,
	deposit text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX leases_unit_id_idx ON leases (unit_id);
CREATE INDEX leases_tenant_id_idx ON leases (tenant_id);

CREATE TABLE rent_adjustments (
	id text PRIMARY KEY NOT NULL,
	lease_id text NOT NULL,
	valid_from text NOT NULL,
	cold_rent text NOT NULL,
	service_charges text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX rent_adjustments_lease_id_idx ON rent_adjustments (lease_id);
CREATE UNIQUE INDEX rent_adjustments_lease_id_valid_from_key ON rent_adjustments (lease_id, valid_from);

CREATE TABLE meters (
	id text PRIMARY KEY NOT NULL,
	unit_id text NOT NULL,
	type text NOT NULL,
	meter_number text NOT NULL,
	location text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX meters_unit_id_idx ON meters (unit_id);

CREATE TABLE meter_readings (
	id text PRIMARY KEY NOT NULL,
	meter_id text NOT NULL,
	value text NOT NULL,
	reading_date text NOT NULL,
	notes text,
	created_at text NOT NULL,
	FOREIGN KEY (meter_id) REFERENCES meters(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX meter_readings_meter_id_idx ON meter_readings (meter_id);

CREATE TABLE deposits (
	id text PRIMARY KEY NOT NULL,
	lease_id text NOT NULL,
	type text DEFAULT 'CASH' NOT NULL,
	amount text NOT NULL,
	status text DEFAULT 'PENDING' NOT NULL,
	received_date text,
	refunded_date text,
	refunded_amount text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX deposits_lease_id_unique ON deposits (lease_id);

CREATE TABLE protocols (
	id text PRIMARY KEY NOT NULL,
	lease_id text NOT NULL,
	type text NOT NULL,
	protocol_date text NOT NULL,
	notes text,
	photo_paths text DEFAULT '[]' NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX protocols_lease_id_idx ON protocols (lease_id);

CREATE TABLE tickets (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	unit_id text,
	title text NOT NULL,
	description text,
	status text DEFAULT 'OPEN' NOT NULL,
	contractor_notes text,
	resolved_at text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX tickets_property_id_idx ON tickets (property_id);
CREATE INDEX tickets_unit_id_idx ON tickets (unit_id);

CREATE TABLE documents (
	id text PRIMARY KEY NOT NULL,
	property_id text,
	unit_id text,
	tenant_id text,
	type text DEFAULT 'OTHER' NOT NULL,
	file_name text NOT NULL,
	file_path text NOT NULL,
	mime_type text,
	file_size integer,
	ocr_text text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX documents_property_id_idx ON documents (property_id);
CREATE INDEX documents_unit_id_idx ON documents (unit_id);
CREATE INDEX documents_tenant_id_idx ON documents (tenant_id);

CREATE TABLE transactions (
	id text PRIMARY KEY NOT NULL,
	lease_id text NOT NULL,
	amount text NOT NULL,
	due_date text NOT NULL,
	paid_date text,
	purpose text,
	status text DEFAULT 'OPEN' NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX transactions_lease_id_idx ON transactions (lease_id);

CREATE TABLE billing_periods (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	period_from text NOT NULL,
	period_to text NOT NULL,
	status text DEFAULT 'DRAFT' NOT NULL,
	finalized_at text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX billing_periods_property_id_idx ON billing_periods (property_id);

CREATE TABLE cost_items (
	id text PRIMARY KEY NOT NULL,
	billing_period_id text NOT NULL,
	category text DEFAULT 'OTHER' NOT NULL,
	label text NOT NULL,
	amount text NOT NULL,
	allocation_key text NOT NULL,
	direct_unit_id text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (direct_unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX cost_items_billing_period_id_idx ON cost_items (billing_period_id);
CREATE INDEX cost_items_direct_unit_id_idx ON cost_items (direct_unit_id);

CREATE TABLE consumption_values (
	id text PRIMARY KEY NOT NULL,
	cost_item_id text NOT NULL,
	unit_id text NOT NULL,
	value text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (cost_item_id) REFERENCES cost_items(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX consumption_values_unit_id_idx ON consumption_values (unit_id);
CREATE UNIQUE INDEX consumption_values_cost_item_id_unit_id_key ON consumption_values (cost_item_id, unit_id);

CREATE TABLE tenant_statements (
	id text PRIMARY KEY NOT NULL,
	billing_period_id text NOT NULL,
	lease_id text NOT NULL,
	occupied_from text NOT NULL,
	occupied_to text NOT NULL,
	occupied_days integer NOT NULL,
	total_allocated_costs text NOT NULL,
	total_prepayments text NOT NULL,
	balance text NOT NULL,
	pdf_path text,
	pdf_file_size integer,
	pdf_generated_at text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX tenant_statements_lease_id_idx ON tenant_statements (lease_id);
CREATE UNIQUE INDEX tenant_statements_billing_period_id_lease_id_key ON tenant_statements (billing_period_id, lease_id);

CREATE TABLE tenant_statement_lines (
	id text PRIMARY KEY NOT NULL,
	tenant_statement_id text NOT NULL,
	cost_item_id text NOT NULL,
	amount text NOT NULL,
	created_at text NOT NULL,
	FOREIGN KEY (tenant_statement_id) REFERENCES tenant_statements(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (cost_item_id) REFERENCES cost_items(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX tenant_statement_lines_tenant_statement_id_idx ON tenant_statement_lines (tenant_statement_id);
CREATE INDEX tenant_statement_lines_cost_item_id_idx ON tenant_statement_lines (cost_item_id);

CREATE TABLE document_templates (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	category text DEFAULT 'GENERAL' NOT NULL,
	subject text,
	body text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE generated_documents (
	id text PRIMARY KEY NOT NULL,
	template_id text,
	template_title text NOT NULL,
	lease_id text,
	tenant_id text,
	subject text,
	rendered_body text NOT NULL,
	file_path text NOT NULL,
	file_size integer,
	created_at text NOT NULL,
	FOREIGN KEY (template_id) REFERENCES document_templates(id) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX generated_documents_template_id_idx ON generated_documents (template_id);
CREATE INDEX generated_documents_lease_id_idx ON generated_documents (lease_id);
CREATE INDEX generated_documents_tenant_id_idx ON generated_documents (tenant_id);

CREATE TABLE postal_shipments (
	id text PRIMARY KEY NOT NULL,
	source_type text NOT NULL,
	source_id text NOT NULL,
	external_job_id text,
	external_status text,
	mode text NOT NULL,
	status text DEFAULT 'PENDING' NOT NULL,
	error_message text,
	requested_by_user_id text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX postal_shipments_source_idx ON postal_shipments (source_type, source_id);

-- ============================================================
-- WEG-Verwaltung
-- ============================================================

CREATE TABLE hoas (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	name text NOT NULL,
	total_shares real DEFAULT 1000 NOT NULL,
	bank_iban text,
	bank_bic text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict
);
CREATE UNIQUE INDEX hoas_property_id_unique ON hoas (property_id);

CREATE TABLE owners (
	id text PRIMARY KEY NOT NULL,
	first_name text NOT NULL,
	last_name text NOT NULL,
	is_company integer DEFAULT 0 NOT NULL,
	company_name text,
	street text NOT NULL,
	zip_code text NOT NULL,
	city text NOT NULL,
	country text DEFAULT 'Deutschland' NOT NULL,
	email text,
	phone text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE unit_ownerships (
	id text PRIMARY KEY NOT NULL,
	unit_id text NOT NULL,
	owner_id text NOT NULL,
	co_owner_id text,
	start_date text NOT NULL,
	end_date text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (owner_id) REFERENCES owners(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (co_owner_id) REFERENCES owners(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX unit_ownerships_unit_id_idx ON unit_ownerships (unit_id);
CREATE INDEX unit_ownerships_owner_id_idx ON unit_ownerships (owner_id);

CREATE TABLE hoa_custom_allocation_keys (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	label text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX hoa_custom_allocation_keys_hoa_id_idx ON hoa_custom_allocation_keys (hoa_id);

CREATE TABLE hoa_custom_allocation_key_weights (
	id text PRIMARY KEY NOT NULL,
	custom_allocation_key_id text NOT NULL,
	unit_id text NOT NULL,
	weight real NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (custom_allocation_key_id) REFERENCES hoa_custom_allocation_keys(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX hoa_custom_allocation_key_weights_unit_id_idx ON hoa_custom_allocation_key_weights (unit_id);
CREATE UNIQUE INDEX hoa_custom_allocation_key_weights_key_unit_key ON hoa_custom_allocation_key_weights (custom_allocation_key_id, unit_id);

CREATE TABLE economic_plans (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	fiscal_year_from text NOT NULL,
	fiscal_year_to text NOT NULL,
	status text DEFAULT 'DRAFT' NOT NULL,
	finalized_at text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX economic_plans_hoa_id_idx ON economic_plans (hoa_id);

CREATE TABLE economic_plan_unit_shares (
	id text PRIMARY KEY NOT NULL,
	economic_plan_id text NOT NULL,
	unit_id text NOT NULL,
	annual_amount text NOT NULL,
	monthly_amount text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (economic_plan_id) REFERENCES economic_plans(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX economic_plan_unit_shares_unit_id_idx ON economic_plan_unit_shares (unit_id);
CREATE UNIQUE INDEX economic_plan_unit_shares_plan_unit_key ON economic_plan_unit_shares (economic_plan_id, unit_id);

CREATE TABLE annual_statements (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	period_from text NOT NULL,
	period_to text NOT NULL,
	status text DEFAULT 'DRAFT' NOT NULL,
	finalized_at text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX annual_statements_hoa_id_idx ON annual_statements (hoa_id);

CREATE TABLE hoa_cost_items (
	id text PRIMARY KEY NOT NULL,
	context text NOT NULL,
	economic_plan_id text,
	annual_statement_id text,
	category text DEFAULT 'OTHER' NOT NULL,
	label text NOT NULL,
	amount text NOT NULL,
	allocation_key text NOT NULL,
	direct_unit_id text,
	custom_allocation_key_id text,
	is_apportionable integer DEFAULT 1 NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (economic_plan_id) REFERENCES economic_plans(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (annual_statement_id) REFERENCES annual_statements(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (direct_unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (custom_allocation_key_id) REFERENCES hoa_custom_allocation_keys(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX hoa_cost_items_economic_plan_id_idx ON hoa_cost_items (economic_plan_id);
CREATE INDEX hoa_cost_items_annual_statement_id_idx ON hoa_cost_items (annual_statement_id);
CREATE INDEX hoa_cost_items_direct_unit_id_idx ON hoa_cost_items (direct_unit_id);
CREATE INDEX hoa_cost_items_custom_allocation_key_id_idx ON hoa_cost_items (custom_allocation_key_id);

CREATE TABLE hoa_cost_item_consumption_values (
	id text PRIMARY KEY NOT NULL,
	cost_item_id text NOT NULL,
	unit_id text NOT NULL,
	value text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (cost_item_id) REFERENCES hoa_cost_items(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX hoa_cost_item_consumption_values_unit_id_idx ON hoa_cost_item_consumption_values (unit_id);
CREATE UNIQUE INDEX hoa_cost_item_consumption_values_item_unit_key ON hoa_cost_item_consumption_values (cost_item_id, unit_id);

CREATE TABLE annual_statement_unit_results (
	id text PRIMARY KEY NOT NULL,
	annual_statement_id text NOT NULL,
	unit_id text NOT NULL,
	owner_id text NOT NULL,
	owned_from text NOT NULL,
	owned_to text NOT NULL,
	owned_days integer NOT NULL,
	total_allocated_costs text NOT NULL,
	total_prepayments text NOT NULL,
	balance text NOT NULL,
	pdf_path text,
	pdf_file_size integer,
	pdf_generated_at text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (annual_statement_id) REFERENCES annual_statements(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (owner_id) REFERENCES owners(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX annual_statement_unit_results_statement_id_idx ON annual_statement_unit_results (annual_statement_id);
CREATE INDEX annual_statement_unit_results_unit_id_idx ON annual_statement_unit_results (unit_id);
CREATE INDEX annual_statement_unit_results_owner_id_idx ON annual_statement_unit_results (owner_id);

CREATE TABLE annual_statement_unit_result_lines (
	id text PRIMARY KEY NOT NULL,
	unit_result_id text NOT NULL,
	cost_item_id text NOT NULL,
	amount text NOT NULL,
	created_at text NOT NULL,
	FOREIGN KEY (unit_result_id) REFERENCES annual_statement_unit_results(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (cost_item_id) REFERENCES hoa_cost_items(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX annual_statement_unit_result_lines_unit_result_id_idx ON annual_statement_unit_result_lines (unit_result_id);
CREATE INDEX annual_statement_unit_result_lines_cost_item_id_idx ON annual_statement_unit_result_lines (cost_item_id);

CREATE TABLE housing_charges (
	id text PRIMARY KEY NOT NULL,
	unit_id text NOT NULL,
	owner_id text NOT NULL,
	economic_plan_id text,
	amount text NOT NULL,
	due_date text NOT NULL,
	paid_date text,
	purpose text,
	status text DEFAULT 'OPEN' NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (owner_id) REFERENCES owners(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (economic_plan_id) REFERENCES economic_plans(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX housing_charges_unit_id_idx ON housing_charges (unit_id);
CREATE INDEX housing_charges_owner_id_idx ON housing_charges (owner_id);
CREATE INDEX housing_charges_economic_plan_id_idx ON housing_charges (economic_plan_id);

CREATE TABLE reserve_fund_bookings (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	booking_date text NOT NULL,
	type text NOT NULL,
	amount text NOT NULL,
	description text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX reserve_fund_bookings_hoa_id_idx ON reserve_fund_bookings (hoa_id);

CREATE TABLE owner_meetings (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	title text NOT NULL,
	type text DEFAULT 'ORDINARY' NOT NULL,
	status text DEFAULT 'PLANNED' NOT NULL,
	meeting_date text,
	location text,
	invitation_sent_at text,
	invitation_pdf_path text,
	invitation_pdf_file_size integer,
	invitation_pdf_generated_at text,
	minutes_text text,
	minutes_finalized_at text,
	minutes_pdf_path text,
	minutes_pdf_file_size integer,
	minutes_pdf_generated_at text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX owner_meetings_hoa_id_idx ON owner_meetings (hoa_id);

CREATE TABLE owner_meeting_agenda_items (
	id text PRIMARY KEY NOT NULL,
	meeting_id text NOT NULL,
	position integer DEFAULT 1 NOT NULL,
	title text NOT NULL,
	description text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (meeting_id) REFERENCES owner_meetings(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX owner_meeting_agenda_items_meeting_id_idx ON owner_meeting_agenda_items (meeting_id);

CREATE TABLE owner_resolutions (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	meeting_id text NOT NULL,
	agenda_item_id text,
	sequence_number integer NOT NULL,
	title text NOT NULL,
	content text NOT NULL,
	voting_result text NOT NULL,
	votes_for real,
	votes_against real,
	votes_abstained real,
	resolved_at text NOT NULL,
	contested_until text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (meeting_id) REFERENCES owner_meetings(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (agenda_item_id) REFERENCES owner_meeting_agenda_items(id) ON UPDATE no action ON DELETE set null
);
CREATE INDEX owner_resolutions_meeting_id_idx ON owner_resolutions (meeting_id);
CREATE INDEX owner_resolutions_hoa_id_idx ON owner_resolutions (hoa_id);
CREATE UNIQUE INDEX owner_resolutions_hoa_id_sequence_number_key ON owner_resolutions (hoa_id, sequence_number);

-- ============================================================
-- Systemeinstellungen & Authentifizierung
-- ============================================================

CREATE TABLE company_settings (
	id text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	name text DEFAULT '' NOT NULL,
	street text DEFAULT '' NOT NULL,
	zip_code text DEFAULT '' NOT NULL,
	city text DEFAULT '' NOT NULL,
	additional text,
	updated_at text NOT NULL
);

CREATE TABLE users (
	id text PRIMARY KEY NOT NULL,
	email text NOT NULL,
	password_hash text NOT NULL,
	role text DEFAULT 'USER' NOT NULL,
	is_approved integer DEFAULT 0 NOT NULL,
	email_verified text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);
CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE sessions (
	id text PRIMARY KEY NOT NULL,
	session_token text NOT NULL,
	user_id text NOT NULL,
	expires text NOT NULL,
	created_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX sessions_session_token_unique ON sessions (session_token);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE verification_tokens (
	identifier text NOT NULL,
	token text NOT NULL,
	expires text NOT NULL,
	created_at text NOT NULL
);
CREATE UNIQUE INDEX verification_tokens_token_unique ON verification_tokens (token);
CREATE UNIQUE INDEX verification_tokens_identifier_token_key ON verification_tokens (identifier, token);

CREATE TABLE password_reset_tokens (
	identifier text NOT NULL,
	token text NOT NULL,
	expires text NOT NULL,
	created_at text NOT NULL
);
CREATE UNIQUE INDEX password_reset_tokens_token_unique ON password_reset_tokens (token);
CREATE UNIQUE INDEX password_reset_tokens_identifier_token_key ON password_reset_tokens (identifier, token);
`,
	down: `
-- Vollständiger Rückbau (leere Datenbank). foreign_keys muss dafür kurz
-- deaktiviert werden, damit die Drop-Reihenfolge keine Rolle spielt.
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS company_settings;
DROP TABLE IF EXISTS owner_resolutions;
DROP TABLE IF EXISTS owner_meeting_agenda_items;
DROP TABLE IF EXISTS owner_meetings;
DROP TABLE IF EXISTS reserve_fund_bookings;
DROP TABLE IF EXISTS housing_charges;
DROP TABLE IF EXISTS annual_statement_unit_result_lines;
DROP TABLE IF EXISTS annual_statement_unit_results;
DROP TABLE IF EXISTS hoa_cost_item_consumption_values;
DROP TABLE IF EXISTS hoa_cost_items;
DROP TABLE IF EXISTS annual_statements;
DROP TABLE IF EXISTS economic_plan_unit_shares;
DROP TABLE IF EXISTS economic_plans;
DROP TABLE IF EXISTS hoa_custom_allocation_key_weights;
DROP TABLE IF EXISTS hoa_custom_allocation_keys;
DROP TABLE IF EXISTS unit_ownerships;
DROP TABLE IF EXISTS owners;
DROP TABLE IF EXISTS hoas;
DROP TABLE IF EXISTS postal_shipments;
DROP TABLE IF EXISTS generated_documents;
DROP TABLE IF EXISTS document_templates;
DROP TABLE IF EXISTS tenant_statement_lines;
DROP TABLE IF EXISTS tenant_statements;
DROP TABLE IF EXISTS consumption_values;
DROP TABLE IF EXISTS cost_items;
DROP TABLE IF EXISTS billing_periods;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS protocols;
DROP TABLE IF EXISTS deposits;
DROP TABLE IF EXISTS meter_readings;
DROP TABLE IF EXISTS meters;
DROP TABLE IF EXISTS rent_adjustments;
DROP TABLE IF EXISTS leases;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS properties;
PRAGMA foreign_keys = ON;
`,
};
