-- Referenz-Gesamtschema von ImmoBase (generiert aus den Migrationen unter
-- src/data/migrations/ - NICHT händisch editieren; Quelle der Wahrheit sind die Migrationen.
-- Konsistenz wird durch src/data/schema.test.ts sichergestellt.)

CREATE TABLE accounts (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	label text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE annual_statement_unit_result_lines (
	id text PRIMARY KEY NOT NULL,
	unit_result_id text NOT NULL,
	cost_item_id text NOT NULL,
	amount text NOT NULL,
	created_at text NOT NULL,
	FOREIGN KEY (unit_result_id) REFERENCES annual_statement_unit_results(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (cost_item_id) REFERENCES hoa_cost_items(id) ON UPDATE no action ON DELETE restrict
);

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

CREATE TABLE app_settings (
	key text PRIMARY KEY NOT NULL,
	value text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE audit_log_entries (
	id text PRIMARY KEY NOT NULL,
	user_id text,
	user_email text NOT NULL,
	action text NOT NULL,
	category text NOT NULL,
	description text NOT NULL,
	entity_id text,
	created_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);

CREATE TABLE bank_transaction_allocations (
	id text PRIMARY KEY NOT NULL,
	bank_transaction_id text NOT NULL,
	account_id text,
	transaction_id text,
	amount text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL, housing_charge_id text REFERENCES housing_charges(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE bank_transactions (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	booking_date text NOT NULL,
	amount text NOT NULL,
	description text NOT NULL,
	partner text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE calendar_events (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	description text,
	start_date text NOT NULL,
	end_date text,
	created_at text NOT NULL,
	updated_at text NOT NULL
, start_time text, end_time text);

CREATE TABLE chat_messages (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	role text NOT NULL,
	content text NOT NULL,
	tool_calls text,
	created_at text NOT NULL, attachments text,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE company_settings (
	id text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	name text DEFAULT '' NOT NULL,
	street text DEFAULT '' NOT NULL,
	zip_code text DEFAULT '' NOT NULL,
	city text DEFAULT '' NOT NULL,
	additional text,
	updated_at text NOT NULL
);

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

CREATE TABLE cost_items (
	id text PRIMARY KEY NOT NULL,
	billing_period_id text NOT NULL,
	label text NOT NULL,
	amount text NOT NULL,
	allocation_key text NOT NULL,
	direct_unit_id text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL, custom_allocation_key_id text REFERENCES custom_allocation_keys(id) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (direct_unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);

CREATE TABLE custom_allocation_key_weights (
	id text PRIMARY KEY NOT NULL,
	custom_allocation_key_id text NOT NULL,
	unit_id text NOT NULL,
	weight real NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (custom_allocation_key_id) REFERENCES custom_allocation_keys(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE custom_allocation_keys (
	id text PRIMARY KEY NOT NULL,
	property_id text NOT NULL,
	label text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE document_templates (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	category text DEFAULT 'GENERAL' NOT NULL,
	subject text,
	body text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL
);

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

CREATE TABLE hoa_cost_items (
	id text PRIMARY KEY NOT NULL,
	context text NOT NULL,
	economic_plan_id text,
	annual_statement_id text,
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

CREATE TABLE hoa_custom_allocation_keys (
	id text PRIMARY KEY NOT NULL,
	hoa_id text NOT NULL,
	label text NOT NULL,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (hoa_id) REFERENCES hoas(id) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE imap_sync_state (
	folder text PRIMARY KEY NOT NULL,
	uid_validity integer DEFAULT 0 NOT NULL,
	last_uid integer DEFAULT 0 NOT NULL,
	last_sync_at text,
	last_error text,
	last_new_count integer
);

CREATE TABLE knowledge_base_articles (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	category text,
	content text NOT NULL,
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
	deposit text,
	notes text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON UPDATE no action ON DELETE restrict
);

CREATE TABLE meter_readings (
	id text PRIMARY KEY NOT NULL,
	meter_id text NOT NULL,
	value text NOT NULL,
	reading_date text NOT NULL,
	notes text,
	created_at text NOT NULL,
	FOREIGN KEY (meter_id) REFERENCES meters(id) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE password_reset_tokens (
	identifier text NOT NULL,
	token text NOT NULL,
	expires text NOT NULL,
	created_at text NOT NULL
);

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

CREATE TABLE prompt_templates (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	title text NOT NULL,
	content text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE sessions (
	id text PRIMARY KEY NOT NULL,
	session_token text NOT NULL,
	user_id text NOT NULL,
	expires text NOT NULL,
	created_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE tenant_statement_lines (
	id text PRIMARY KEY NOT NULL,
	tenant_statement_id text NOT NULL,
	cost_item_id text NOT NULL,
	amount text NOT NULL,
	created_at text NOT NULL,
	FOREIGN KEY (tenant_statement_id) REFERENCES tenant_statements(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (cost_item_id) REFERENCES cost_items(id) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE "ticket_messages" (
	id text PRIMARY KEY NOT NULL,
	ticket_id text,
	direction text NOT NULL,
	message_id text,
	imap_folder text,
	imap_uid integer,
	from_address text,
	to_addresses text,
	subject text,
	body_text text,
	author_user_id text,
	author_email text,
	created_at text NOT NULL,
	FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (author_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE set null
);

CREATE TABLE "tickets" (
	id text PRIMARY KEY NOT NULL,
	property_id text,
	unit_id text,
	title text NOT NULL,
	description text,
	status text DEFAULT 'OPEN' NOT NULL,
	resolved_at text,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE no action ON DELETE set null
);

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

CREATE TABLE verification_tokens (
	identifier text NOT NULL,
	token text NOT NULL,
	expires text NOT NULL,
	created_at text NOT NULL
);

CREATE INDEX accounts_property_id_idx ON accounts (property_id);

CREATE INDEX annual_statement_unit_result_lines_cost_item_id_idx ON annual_statement_unit_result_lines (cost_item_id);

CREATE INDEX annual_statement_unit_result_lines_unit_result_id_idx ON annual_statement_unit_result_lines (unit_result_id);

CREATE INDEX annual_statement_unit_results_owner_id_idx ON annual_statement_unit_results (owner_id);

CREATE INDEX annual_statement_unit_results_statement_id_idx ON annual_statement_unit_results (annual_statement_id);

CREATE INDEX annual_statement_unit_results_unit_id_idx ON annual_statement_unit_results (unit_id);

CREATE INDEX annual_statements_hoa_id_idx ON annual_statements (hoa_id);

CREATE INDEX audit_log_entries_category_idx ON audit_log_entries (category);

CREATE INDEX audit_log_entries_created_at_idx ON audit_log_entries (created_at DESC);

CREATE INDEX audit_log_entries_user_id_idx ON audit_log_entries (user_id);

CREATE INDEX bank_transaction_allocations_account_id_idx ON bank_transaction_allocations (account_id);

CREATE INDEX bank_transaction_allocations_bank_transaction_id_idx ON bank_transaction_allocations (bank_transaction_id);

CREATE INDEX bank_transaction_allocations_housing_charge_id_idx ON bank_transaction_allocations (housing_charge_id);

CREATE INDEX bank_transaction_allocations_transaction_id_idx ON bank_transaction_allocations (transaction_id);

CREATE INDEX bank_transactions_booking_date_idx ON bank_transactions (booking_date);

CREATE INDEX bank_transactions_property_id_idx ON bank_transactions (property_id);

CREATE INDEX billing_periods_property_id_idx ON billing_periods (property_id);

CREATE INDEX calendar_events_start_date_idx ON calendar_events (start_date);

CREATE INDEX chat_messages_user_idx ON chat_messages (user_id);

CREATE UNIQUE INDEX consumption_values_cost_item_id_unit_id_key ON consumption_values (cost_item_id, unit_id);

CREATE INDEX consumption_values_unit_id_idx ON consumption_values (unit_id);

CREATE INDEX cost_items_billing_period_id_idx ON cost_items (billing_period_id);

CREATE INDEX cost_items_custom_allocation_key_id_idx ON cost_items (custom_allocation_key_id);

CREATE INDEX cost_items_direct_unit_id_idx ON cost_items (direct_unit_id);

CREATE UNIQUE INDEX custom_allocation_key_weights_key_unit_key ON custom_allocation_key_weights (custom_allocation_key_id, unit_id);

CREATE INDEX custom_allocation_key_weights_unit_id_idx ON custom_allocation_key_weights (unit_id);

CREATE INDEX custom_allocation_keys_property_id_idx ON custom_allocation_keys (property_id);

CREATE UNIQUE INDEX deposits_lease_id_unique ON deposits (lease_id);

CREATE INDEX documents_property_id_idx ON documents (property_id);

CREATE INDEX documents_tenant_id_idx ON documents (tenant_id);

CREATE INDEX documents_unit_id_idx ON documents (unit_id);

CREATE UNIQUE INDEX economic_plan_unit_shares_plan_unit_key ON economic_plan_unit_shares (economic_plan_id, unit_id);

CREATE INDEX economic_plan_unit_shares_unit_id_idx ON economic_plan_unit_shares (unit_id);

CREATE INDEX economic_plans_hoa_id_idx ON economic_plans (hoa_id);

CREATE INDEX generated_documents_lease_id_idx ON generated_documents (lease_id);

CREATE INDEX generated_documents_template_id_idx ON generated_documents (template_id);

CREATE INDEX generated_documents_tenant_id_idx ON generated_documents (tenant_id);

CREATE UNIQUE INDEX hoa_cost_item_consumption_values_item_unit_key ON hoa_cost_item_consumption_values (cost_item_id, unit_id);

CREATE INDEX hoa_cost_item_consumption_values_unit_id_idx ON hoa_cost_item_consumption_values (unit_id);

CREATE INDEX hoa_cost_items_annual_statement_id_idx ON hoa_cost_items (annual_statement_id);

CREATE INDEX hoa_cost_items_custom_allocation_key_id_idx ON hoa_cost_items (custom_allocation_key_id);

CREATE INDEX hoa_cost_items_direct_unit_id_idx ON hoa_cost_items (direct_unit_id);

CREATE INDEX hoa_cost_items_economic_plan_id_idx ON hoa_cost_items (economic_plan_id);

CREATE UNIQUE INDEX hoa_custom_allocation_key_weights_key_unit_key ON hoa_custom_allocation_key_weights (custom_allocation_key_id, unit_id);

CREATE INDEX hoa_custom_allocation_key_weights_unit_id_idx ON hoa_custom_allocation_key_weights (unit_id);

CREATE INDEX hoa_custom_allocation_keys_hoa_id_idx ON hoa_custom_allocation_keys (hoa_id);

CREATE UNIQUE INDEX hoas_property_id_unique ON hoas (property_id);

CREATE INDEX housing_charges_economic_plan_id_idx ON housing_charges (economic_plan_id);

CREATE INDEX housing_charges_owner_id_idx ON housing_charges (owner_id);

CREATE INDEX housing_charges_unit_id_idx ON housing_charges (unit_id);

CREATE INDEX knowledge_base_articles_title_idx ON knowledge_base_articles (title);

CREATE INDEX leases_tenant_id_idx ON leases (tenant_id);

CREATE INDEX leases_unit_id_idx ON leases (unit_id);

CREATE INDEX meter_readings_meter_id_idx ON meter_readings (meter_id);

CREATE INDEX meters_unit_id_idx ON meters (unit_id);

CREATE INDEX owner_meeting_agenda_items_meeting_id_idx ON owner_meeting_agenda_items (meeting_id);

CREATE INDEX owner_meetings_hoa_id_idx ON owner_meetings (hoa_id);

CREATE INDEX owner_resolutions_hoa_id_idx ON owner_resolutions (hoa_id);

CREATE UNIQUE INDEX owner_resolutions_hoa_id_sequence_number_key ON owner_resolutions (hoa_id, sequence_number);

CREATE INDEX owner_resolutions_meeting_id_idx ON owner_resolutions (meeting_id);

CREATE UNIQUE INDEX password_reset_tokens_identifier_token_key ON password_reset_tokens (identifier, token);

CREATE UNIQUE INDEX password_reset_tokens_token_unique ON password_reset_tokens (token);

CREATE INDEX postal_shipments_source_idx ON postal_shipments (source_type, source_id);

CREATE INDEX prompt_templates_user_idx ON prompt_templates (user_id);

CREATE INDEX protocols_lease_id_idx ON protocols (lease_id);

CREATE INDEX rent_adjustments_lease_id_idx ON rent_adjustments (lease_id);

CREATE UNIQUE INDEX rent_adjustments_lease_id_valid_from_key ON rent_adjustments (lease_id, valid_from);

CREATE INDEX reserve_fund_bookings_hoa_id_idx ON reserve_fund_bookings (hoa_id);

CREATE UNIQUE INDEX sessions_session_token_unique ON sessions (session_token);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE INDEX tenant_statement_lines_cost_item_id_idx ON tenant_statement_lines (cost_item_id);

CREATE INDEX tenant_statement_lines_tenant_statement_id_idx ON tenant_statement_lines (tenant_statement_id);

CREATE UNIQUE INDEX tenant_statements_billing_period_id_lease_id_key ON tenant_statements (billing_period_id, lease_id);

CREATE INDEX tenant_statements_lease_id_idx ON tenant_statements (lease_id);

CREATE UNIQUE INDEX ticket_messages_imap_uq ON ticket_messages (imap_folder, imap_uid) WHERE imap_uid IS NOT NULL;

CREATE INDEX ticket_messages_mailbox_idx ON ticket_messages (direction, ticket_id);

CREATE INDEX ticket_messages_message_id_idx ON ticket_messages (message_id);

CREATE INDEX ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);

CREATE INDEX tickets_property_id_idx ON tickets (property_id);

CREATE INDEX tickets_unit_id_idx ON tickets (unit_id);

CREATE INDEX transactions_lease_id_idx ON transactions (lease_id);

CREATE INDEX unit_ownerships_owner_id_idx ON unit_ownerships (owner_id);

CREATE INDEX unit_ownerships_unit_id_idx ON unit_ownerships (unit_id);

CREATE INDEX units_property_id_idx ON units (property_id);

CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE UNIQUE INDEX verification_tokens_identifier_token_key ON verification_tokens (identifier, token);

CREATE UNIQUE INDEX verification_tokens_token_unique ON verification_tokens (token);
