/**
 * Zentrale Row-Typen für den Repository-Layer (src/data/).
 *
 * Konventionen:
 * - Geldbeträge: Decimal-Strings ("-123.45"), siehe src/lib/money.ts.
 * - Datumswerte: ISO-8601-Strings.
 * - Enums: TEXT mit TypeScript-Union-Typen (kein DB-CHECK).
 * - Booleans: in SQLite als integer 0/1 gespeichert, hier als boolean
 *   abgebildet - das Mapping 0/1 <-> boolean erfolgt ausschließlich in den
 *   Repository-Funktionen (src/data/<domain>.ts).
 * - JSON-Spalten (protocols.photoPaths): string[] in TS, TEXT in SQLite -
 *   Parse/Stringify ebenfalls nur im Repository-Layer.
 */

// ============================================================
// Liegenschaften & Einheiten
// ============================================================

export interface Property {
	id: string;
	name: string;
	street: string;
	zipCode: string;
	city: string;
	country: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Unit {
	id: string;
	propertyId: string;
	label: string;
	livingSpace: number | null;
	rooms: number | null;
	floor: string | null;
	/** Miteigentumsanteil (Zähler; Nenner = Hoa.totalShares) - WEG-Verwaltung. */
	coOwnershipShare: number | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Mieter & Mietverträge
// ============================================================

export interface Tenant {
	id: string;
	firstName: string;
	lastName: string;
	email: string | null;
	phone: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Lease {
	id: string;
	unitId: string;
	tenantId: string;
	startDate: string;
	endDate: string | null;
	coldRent: string;
	serviceCharges: string;
	numberOfOccupants: number;
	deposit: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RentAdjustment {
	id: string;
	leaseId: string;
	validFrom: string;
	coldRent: string;
	serviceCharges: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Zählerstände
// ============================================================

export type MeterType = "ELECTRICITY" | "WATER" | "HEATING";

export interface Meter {
	id: string;
	unitId: string;
	type: MeterType;
	meterNumber: string;
	location: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MeterReading {
	id: string;
	meterId: string;
	value: string;
	readingDate: string;
	notes: string | null;
	createdAt: string;
}

// ============================================================
// Kaution
// ============================================================

export type DepositType = "CASH" | "BANK_GUARANTEE" | "BLOCKED_ACCOUNT";
export type DepositStatus = "PENDING" | "RECEIVED" | "PARTIALLY_REFUNDED" | "REFUNDED";

export interface Deposit {
	id: string;
	leaseId: string;
	type: DepositType;
	amount: string;
	status: DepositStatus;
	receivedDate: string | null;
	refundedDate: string | null;
	refundedAmount: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Übergabeprotokolle
// ============================================================

export type ProtocolType = "MOVE_IN" | "MOVE_OUT";

export interface Protocol {
	id: string;
	leaseId: string;
	type: ProtocolType;
	protocolDate: string;
	notes: string | null;
	photoPaths: string[];
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Tickets
// ============================================================

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export interface Ticket {
	id: string;
	propertyId: string;
	unitId: string | null;
	title: string;
	description: string | null;
	status: TicketStatus;
	contractorNotes: string | null;
	resolvedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Dokumente (DMS)
// ============================================================

export type DocumentType = "CONTRACT" | "INVOICE" | "FLOORPLAN" | "OTHER";

export interface DocumentRecord {
	id: string;
	propertyId: string | null;
	unitId: string | null;
	tenantId: string | null;
	type: DocumentType;
	fileName: string;
	filePath: string;
	mimeType: string | null;
	fileSize: number | null;
	ocrText: string | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Finanzen / Mieteingänge
// ============================================================

export type TransactionStatus = "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Transaction {
	id: string;
	leaseId: string;
	amount: string;
	dueDate: string;
	paidDate: string | null;
	purpose: string | null;
	status: TransactionStatus;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Nebenkostenabrechnung
// ============================================================

export type BillingPeriodStatus = "DRAFT" | "FINALIZED";
export type AllocationKey = "LIVING_SPACE" | "OCCUPANTS" | "UNITS" | "CONSUMPTION" | "DIRECT";
export type CostCategory =
	| "PUBLIC_CHARGES"
	| "WATER_SUPPLY"
	| "DRAINAGE"
	| "HEATING"
	| "HOT_WATER"
	| "HEATING_HOT_WATER_COMBINED"
	| "ELEVATOR"
	| "STREET_CLEANING_WASTE"
	| "BUILDING_CLEANING_PEST_CONTROL"
	| "GARDEN_MAINTENANCE"
	| "LIGHTING"
	| "CHIMNEY_CLEANING"
	| "INSURANCE"
	| "CARETAKER"
	| "CABLE_ANTENNA"
	| "LAUNDRY_FACILITIES"
	| "OTHER";

export interface BillingPeriod {
	id: string;
	propertyId: string;
	periodFrom: string;
	periodTo: string;
	status: BillingPeriodStatus;
	finalizedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CostItem {
	id: string;
	billingPeriodId: string;
	category: CostCategory;
	label: string;
	amount: string;
	allocationKey: AllocationKey;
	directUnitId: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ConsumptionValue {
	id: string;
	costItemId: string;
	unitId: string;
	value: string;
	createdAt: string;
	updatedAt: string;
}

export interface TenantStatement {
	id: string;
	billingPeriodId: string;
	leaseId: string;
	occupiedFrom: string;
	occupiedTo: string;
	occupiedDays: number;
	totalAllocatedCosts: string;
	totalPrepayments: string;
	balance: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
	pdfGeneratedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TenantStatementLine {
	id: string;
	tenantStatementId: string;
	costItemId: string;
	amount: string;
	createdAt: string;
}

// ============================================================
// Dokumentvorlagen
// ============================================================

export type DocumentTemplateCategory = "WARNING" | "BILLING" | "GENERAL" | "TERMINATION" | "OTHER";

export interface DocumentTemplate {
	id: string;
	title: string;
	category: DocumentTemplateCategory;
	subject: string | null;
	body: string;
	createdAt: string;
	updatedAt: string;
}

export interface GeneratedDocument {
	id: string;
	templateId: string | null;
	templateTitle: string;
	leaseId: string | null;
	tenantId: string | null;
	subject: string | null;
	renderedBody: string;
	filePath: string;
	fileSize: number | null;
	createdAt: string;
}

// ============================================================
// Postversand (LetterXpress)
// ============================================================

export type PostalShipmentSourceType =
	| "TENANT_STATEMENT"
	| "GENERATED_DOCUMENT"
	| "DOCUMENT"
	| "HOA_ANNUAL_STATEMENT"
	| "HOA_MEETING_INVITATION"
	| "HOA_MEETING_MINUTES";
export type PostalShipmentMode = "test" | "live";
export type PostalShipmentStatus = "PENDING" | "REGISTERED" | "FAILED";

export interface PostalShipment {
	id: string;
	sourceType: PostalShipmentSourceType;
	sourceId: string;
	externalJobId: string | null;
	externalStatus: string | null;
	mode: PostalShipmentMode;
	status: PostalShipmentStatus;
	errorMessage: string | null;
	requestedByUserId: string | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// WEG-Verwaltung
// ============================================================

export type HoaAllocationKey = "MEA" | "LIVING_SPACE" | "UNITS" | "CONSUMPTION" | "DIRECT" | "CUSTOM";
export type HoaCostCategory =
	| "RESERVE_CONTRIBUTION"
	| "ADMINISTRATOR_FEE"
	| "INSURANCE"
	| "CARETAKER"
	| "MAINTENANCE_REPAIR"
	| "WATER_DRAINAGE"
	| "HEATING"
	| "ELECTRICITY_COMMON"
	| "CLEANING"
	| "GARDEN_MAINTENANCE"
	| "ELEVATOR"
	| "LEGAL_ADVICE"
	| "BANK_FEES"
	| "OTHER";
export type EconomicPlanStatus = "DRAFT" | "FINALIZED";
export type AnnualStatementStatus = "DRAFT" | "FINALIZED";
export type ReserveFundBookingType = "CONTRIBUTION" | "WITHDRAWAL";
export type HousingChargeStatus = "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";
export type OwnerMeetingType = "ORDINARY" | "EXTRAORDINARY" | "CIRCULATION";
export type OwnerMeetingStatus = "PLANNED" | "INVITED" | "HELD" | "MINUTES_FINALIZED" | "CANCELLED";
export type ResolutionVotingResult = "ACCEPTED" | "REJECTED";
export type HoaCostItemContext = "PLAN" | "STATEMENT";

export interface Hoa {
	id: string;
	propertyId: string;
	name: string;
	totalShares: number;
	bankIban: string | null;
	bankBic: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Owner {
	id: string;
	firstName: string;
	lastName: string;
	isCompany: boolean;
	companyName: string | null;
	street: string;
	zipCode: string;
	city: string;
	country: string;
	email: string | null;
	phone: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface UnitOwnership {
	id: string;
	unitId: string;
	ownerId: string;
	coOwnerId: string | null;
	startDate: string;
	endDate: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface HoaCustomAllocationKey {
	id: string;
	hoaId: string;
	label: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface HoaCustomAllocationKeyWeight {
	id: string;
	customAllocationKeyId: string;
	unitId: string;
	weight: number;
	createdAt: string;
	updatedAt: string;
}

export interface EconomicPlan {
	id: string;
	hoaId: string;
	fiscalYearFrom: string;
	fiscalYearTo: string;
	status: EconomicPlanStatus;
	finalizedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface EconomicPlanUnitShare {
	id: string;
	economicPlanId: string;
	unitId: string;
	annualAmount: string;
	monthlyAmount: string;
	createdAt: string;
	updatedAt: string;
}

export interface AnnualStatement {
	id: string;
	hoaId: string;
	periodFrom: string;
	periodTo: string;
	status: AnnualStatementStatus;
	finalizedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface HoaCostItem {
	id: string;
	context: HoaCostItemContext;
	economicPlanId: string | null;
	annualStatementId: string | null;
	category: HoaCostCategory;
	label: string;
	amount: string;
	allocationKey: HoaAllocationKey;
	directUnitId: string | null;
	customAllocationKeyId: string | null;
	isApportionable: boolean;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface HoaCostItemConsumptionValue {
	id: string;
	costItemId: string;
	unitId: string;
	value: string;
	createdAt: string;
	updatedAt: string;
}

export interface AnnualStatementUnitResult {
	id: string;
	annualStatementId: string;
	unitId: string;
	ownerId: string;
	ownedFrom: string;
	ownedTo: string;
	ownedDays: number;
	totalAllocatedCosts: string;
	totalPrepayments: string;
	balance: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
	pdfGeneratedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AnnualStatementUnitResultLine {
	id: string;
	unitResultId: string;
	costItemId: string;
	amount: string;
	createdAt: string;
}

export interface HousingCharge {
	id: string;
	unitId: string;
	ownerId: string;
	economicPlanId: string | null;
	amount: string;
	dueDate: string;
	paidDate: string | null;
	purpose: string | null;
	status: HousingChargeStatus;
	createdAt: string;
	updatedAt: string;
}

export interface ReserveFundBooking {
	id: string;
	hoaId: string;
	bookingDate: string;
	type: ReserveFundBookingType;
	amount: string;
	description: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface OwnerMeeting {
	id: string;
	hoaId: string;
	title: string;
	type: OwnerMeetingType;
	status: OwnerMeetingStatus;
	meetingDate: string | null;
	location: string | null;
	invitationSentAt: string | null;
	invitationPdfPath: string | null;
	invitationPdfFileSize: number | null;
	invitationPdfGeneratedAt: string | null;
	minutesText: string | null;
	minutesFinalizedAt: string | null;
	minutesPdfPath: string | null;
	minutesPdfFileSize: number | null;
	minutesPdfGeneratedAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface OwnerMeetingAgendaItem {
	id: string;
	meetingId: string;
	position: number;
	title: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface OwnerResolution {
	id: string;
	hoaId: string;
	meetingId: string;
	agendaItemId: string | null;
	sequenceNumber: number;
	title: string;
	content: string;
	votingResult: ResolutionVotingResult;
	votesFor: number | null;
	votesAgainst: number | null;
	votesAbstained: number | null;
	resolvedAt: string;
	contestedUntil: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

// ============================================================
// Systemeinstellungen
// ============================================================

export interface CompanySettings {
	id: string;
	name: string;
	street: string;
	zipCode: string;
	city: string;
	additional: string | null;
	updatedAt: string;
}

// ============================================================
// Authentifizierung & Benutzerverwaltung
// ============================================================

export type Role = "ADMIN" | "USER";

export interface User {
	id: string;
	email: string;
	passwordHash: string;
	role: Role;
	isApproved: boolean;
	emailVerified: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Session {
	id: string;
	sessionToken: string;
	userId: string;
	expires: string;
	createdAt: string;
}

export interface VerificationToken {
	identifier: string;
	token: string;
	expires: string;
	createdAt: string;
}

export interface PasswordResetToken {
	identifier: string;
	token: string;
	expires: string;
	createdAt: string;
}
