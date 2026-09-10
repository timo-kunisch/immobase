import { chat as deChat } from "../de/chat";

/** Englische Übersetzungen des Namespace "chat" (Parität per Typ erzwungen). */
export const chat: typeof deChat = {
	title: "AI assistant",
	description:
		"Answers questions about your data and can make changes on request (via the MCP server tools). Files (PDF, Office documents, Excel, images, text/code) can be attached.",
	disabledHint: "The AI assistant is disabled - an administrator can configure an endpoint under Settings → AI assistant",
	loadingHistory: "Loading the saved chat history…",
	emptyGreeting:
		"Ask a question about your data or request changes,\ne.g. \"Which leases expire in 2026?\" or \"Create the tenants from the attached Excel spreadsheet\".",
	emptyPersistenceHint: "The history is kept until you delete it via the trash button.",
	toolOk: "Tool executed successfully",
	toolFailed: "Tool call failed",
	showFewerTools: "Show fewer tool calls",
	showAllTools: "Show all {count} tool calls",
	showLessLabel: "less",
	loadFailed: "The chat history could not be loaded.",
	loadFailedHttp: "The chat history could not be loaded (HTTP {status}).",
	deleteFailed: "The chat history could not be deleted.",
	deleteFailedHttp: "The chat history could not be deleted (HTTP {status}).",
	requestFailed: "The request failed.",
	requestFailedHttp: "The request failed (HTTP {status}).",
	serverResponseSnippet: " Server response: {snippet}",
	replyReady: "The reply to your message is ready.",
	replyFailedPrefix: "The request failed: {message}",
	attachmentOnly: "(file attachment without message text)",
	aiWorking: "The AI is working (tool calls may take a moment)…",
	maxAttachments: "At most {max} attachments per message are allowed.",
	fileTooLarge: "The file \"{name}\" is too large ({size} - allowed are at most {max}).",
	fileUnreadable: "The file \"{name}\" could not be read.",
	hardLimitReached: "The chat history has reached the maximum size of {max} characters ({current} characters).",
	hardLimitHint: "Before you can continue, the history must be deleted - the entire history is sent to the AI with every message.",
	clearingHistory: "Deleting history…",
	clearHistoryNow: "Delete history now",
	historyLarge: "The chat history has grown very large ({current} characters).",
	historyLargeHint:
		"Since the entire history is sent to the AI with every message, token consumption (and thus cost and response time) increases noticeably. It is recommended to delete the history and start a new conversation. Continuing is blocked from {max} characters.",
	removeAttachment: "Remove attachment {name}",
	attachTitle: "Attach file (PDF, Office, Excel, images, text/code)",
	attachAria: "Attach file",
	placeholderDefault: "Message to the AI… (Enter sends, Shift+Enter for a line break)",
	placeholderHardLimit: "Maximum history size reached - please delete the history first.",
	sendTitle: "Send",
	clearTitle: "Delete chat history (start a new conversation)",
	clearAria: "Delete chat history",
	openChat: "Open chat",
	closeNotice: "Close notification",
	// Route /api/chat (+ /api/chat/history): error messages to the client
	"route.unauthorized": "Not signed in.",
	"route.notConfigured": "No AI endpoint is configured. Setup: Settings → AI assistant.",
	"route.invalidJson": "The request body is not valid JSON.",
	"route.bodyNotObject": "The request body must be a JSON object.",
	"route.messageInvalid": "Expected a non-empty message with at most {max} characters.",
	"route.attachmentsTooMany": "Expected at most {max} file attachments.",
	"route.attachmentInvalid": "Invalid attachment format.",
	"route.attachmentNameInvalid": "Invalid file name in attachment.",
	"route.attachmentTooLarge": "The attachment \"{name}\" is too large or corrupted.",
	"route.hardLimit":
		"The chat history has reached the maximum size of {max} characters. Please delete the history in the dialog (trash button) before continuing.",
	"route.internalError": "Internal error during processing (details in the server log).",
	"route.serverError": "Internal server error in the chat endpoint (details in the server log).",
	"route.historyLoadFailed": "The chat history could not be loaded (details in the server log).",
	"route.historyDeleteFailed": "The chat history could not be deleted (details in the server log).",
	// KI-Stack (src/lib/ai/*): Systemprompt + modell-interne Hinweise des
	// Tool-Loops sowie nutzersichtbare Fehler - sprachlich konsistent zur
	// gewählten App-Sprache (runChat erhält die Locale von der Chat-Route).
	"system.intro":
		"You are the AI assistant of ImmoBase, a desktop application for rental and HOA management (German tenancy law and German WEG law as amended by the 2020 reform).",
	"system.access":
		"Via the provided tools you have read and write access to the application's live data: properties, units, tenants, leases, deposits, tickets, documents, finances, utility cost billings, document templates, as well as HOA management (owners, ownership relations, allocation keys, economic plans, annual statements, housing charges, reserve fund, meetings, resolution collection).",
	"system.rulesHeader": "Behavioral rules:",
	"system.ruleLanguage": "- Reply in English, factual and concise. Keep it short; use lists/tables for long results.",
	"system.ruleTools":
		"- Use the tools to query current data instead of guessing or making things up. Determine the IDs of existing records via the *_list tools (with filters), details via the *_get tools.",
	"system.ruleFormats":
		"- Monetary amounts are decimal strings (\"123.45\"), dates are ISO-8601 (\"2026-09-08\"). The tools also accept comma notation for amounts.",
	"system.ruleDestructive":
		"- Before destructive or irreversible actions (deleting, finalizing utility cost billings/economic plans/annual statements), briefly summarize the planned action including the affected records and obtain the user's explicit confirmation - unless the user has already clearly requested the action.",
	"system.ruleAttachments":
		"- When the user attaches files (e.g. Excel spreadsheets, PDFs, Office documents), their content is inserted into their message as text; attached images are passed to you directly as image input. Diligently transfer data from the attachments via the appropriate *_create tools. Before creating, check which linked records (e.g. property, unit) already exist, and finally report briefly what was created and what did not work.",
	"system.ruleToolErrors": "- Report tool errors (isError/error text) honestly and do not try to hide them.",
	"system.ruleUserScope":
		"- The signed-in user is NOT an administrator: administration functions (user management, settings such as the sender details) are not available as tools. For such requests, politely point out that an administrator account is required.",
	"system.footer": "Current date: {today}. Signed-in user: {userEmail}.",
	"system.toolInvalidArgsDetail": "Invalid arguments (not JSON) from the model.",
	"system.toolInvalidArgsMessage": "Error: The requested arguments are not valid JSON - please try again.",
	"system.toolInternalError": "Internal error during execution (details in the server log).",
	"system.toolErrorPrefix": "Error: {detail}",
	"system.toolResultTruncated":
		"[... truncated: The tool result exceeds the maximum length of {max} characters. Use filters or *_get tools for more targeted queries. ...]",
	"client.unreachable":
		"The AI endpoint ({baseUrl}) is not reachable. Please check the configuration under Settings → AI assistant and whether the service is running.",
	"client.httpError": "The AI endpoint reports HTTP {status}{hint}.",
	"client.httpErrorDetail": " Response: {detail}",
	"client.hintAuth": " (check API key)",
	"client.hintNotFound": " (check base URL/model)",
	"client.hintTimeout": " (timeout: the endpoint did not deliver the response in time even after several attempts - please try again)",
	"client.invalidJson": "The AI endpoint did not return a valid JSON response.",
	"client.unexpectedFormat": "The AI endpoint returned an unexpected response format (no choices[0].message).",
	"client.emptyReply": "The model returned an empty reply. Please try again.",
	"attach.processingFailed": "The attachment \"{name}\" could not be processed (details in the server log).",
	"attach.markerBegin": "--- Begin file attachment \"{name}\" ---",
	"attach.markerEnd": "--- End file attachment \"{name}\" ---",
	"attach.truncatedChars": "[... truncated: The attachment exceeds the maximum text length of {max} characters ...]",
	"attach.excelUnreadable":
		"The file \"{name}\" could not be read as an Excel workbook. Note: The old .xls format is not supported - please save it as .xlsx in Excel.",
	"attach.sheetHeader": "Worksheet \"{sheet}\" ({rows} rows{truncation}):",
	"attach.sheetTruncated": ", truncated to the first {max} rows",
	"attach.excelNoData": "The file \"{name}\" contains no usable table data.",
	"attach.pdfEngineUnavailable":
		"PDF support could not be initialized (details in the server log). Other file types and chat without attachments continue to work.",
	"attach.pdfOpenFailed": "The PDF file \"{name}\" could not be opened.",
	"attach.pageMarker": "--- Page {page} ---",
	"attach.pdfNoText":
		"The PDF file \"{name}\" contains no extractable text (probably a scan without a text layer). Note: As a workaround, convert the PDF into images and attach those.",
	"attach.pdfPagesTruncated": "[... truncated: Only the first {max} of {total} pages were included ...]",
	"attach.pdfPassword": "The PDF file \"{name}\" is password-protected - please remove the protection and attach it again.",
	"attach.pdfReadFailed": "The PDF file \"{name}\" could not be read (corrupted or not a valid PDF).",
	"attach.officeInvalid": "The file \"{name}\" is corrupted or not a valid {extension} file.",
	"attach.docxInvalid": "The file \"{name}\" does not contain word/document.xml - not a valid DOCX file.",
	"attach.slideMarker": "--- Slide {index} ---",
	"attach.pptxNoText": "The file \"{name}\" contains no extractable slide text.",
	"attach.odfInvalid": "The file \"{name}\" does not contain content.xml - not a valid OpenDocument file.",
	"attach.officeReadFailed": "The file \"{name}\" could not be read (corrupted Office document).",
	"attach.invalidBase64": "The attachment \"{name}\" is corrupted (invalid Base64 encoding).",
	"attach.empty": "The attachment \"{name}\" is empty.",
	"attach.tooLarge": "The attachment \"{name}\" is too large ({size} MB - allowed are at most {max} MB).",
	"attach.legacyXls": "The old .xls format (\"{name}\") is not supported - please save it as .xlsx in Excel and attach it again.",
	"attach.legacyOffice": "The old .{extension} format (\"{name}\") is not supported - please save it as .{extension}x and attach it again.",
	"attach.unsupportedType": "The file type of \"{name}\" is not supported. Allowed are: {types}.",
	"attach.supportedTypesHint":
		"PDF, Word/PowerPoint/OpenDocument (.docx, .pptx, .odt, .ods, .odp), Excel (.xlsx), images (.png, .jpg, .gif, .webp) as well as text/data files (.csv, .txt, .md, .json, .xml, .log, code files and others)",
	"attach.noTextExtracted": "No text could be extracted from the file \"{name}\" (empty or only non-textual content).",
	"budget.warning":
		"System note: You have only {remaining} tool rounds left. Plan efficiently: bundle remaining calls and bring the task to completion soon. If the budget is clearly insufficient, prepare an interim summary instead: what is already done, what remains open?",
	"budget.exhaustedNote":
		"System note: The tool budget is exhausted - no further tool calls are available to you. Now give the user a final answer: briefly summarize what you have already completed or found out, state concretely what is still open, and point out that the user can trigger the continuation with \"continue\" (or a concrete follow-up instruction).",
	"budget.fallbackReply":
		"The tool budget of {max} rounds is exhausted. {total} tool calls were executed ({failed} of them failed). Write \"continue\" so the assistant proceeds - or phrase the request more specifically.",
	// Prompt templates (button in the input area): reusable text snippets -
	// factory templates from src/lib/ai/prompt-templates.ts (texts below
	// under templates.defaults.*) plus the user's own templates (table
	// prompt_templates, route /api/chat/prompt-templates).
	"templates.buttonTitle": "Prompt templates",
	"templates.buttonAria": "Show or hide prompt templates",
	"templates.title": "Prompt templates",
	"templates.hint": "Click a template to insert it into the input field.",
	"templates.insert": "Insert into the input field",
	"templates.defaultBadge": "Built-in",
	"templates.emptyMine": "No custom templates created yet.",
	"templates.new": "New template",
	"templates.edit": "Edit template",
	"templates.delete": "Delete template",
	"templates.deleteConfirm": "Really delete?",
	"templates.formTitleNew": "Create new template",
	"templates.formTitleEdit": "Edit template",
	"templates.namePlaceholder": "Template title",
	"templates.contentPlaceholder": "Template text - inserted into the input field on click…",
	"templates.validation": "Please fill in title and text (title max. {maxTitle} characters, text max. {maxContent} characters).",
	"templates.loading": "Loading templates…",
	"templates.loadFailed": "The templates could not be loaded (HTTP {status}).",
	"templates.saveFailed": "The template could not be saved (HTTP {status}).",
	"templates.deleteFailed": "The template could not be deleted (HTTP {status}).",
	// Route /api/chat/prompt-templates: error messages to the client
	"templates.route.invalidPayload":
		"Expected a non-empty title (max. {maxTitle} characters) and a non-empty text (max. {maxContent} characters).",
	"templates.route.limitReached": "At most {max} custom templates are allowed.",
	"templates.route.invalidId": "Invalid or missing template ID.",
	"templates.route.notFound": "The template was not found.",
	"templates.route.loadFailed": "The templates could not be loaded (details in the server log).",
	"templates.route.saveFailed": "The template could not be saved (details in the server log).",
	"templates.route.deleteFailed": "The template could not be deleted (details in the server log).",
	// Built-in templates (localized, for all users; not editable). The first
	// template is the central file import: the user just attaches a file,
	// the model extracts the data and imports it via the MCP tools.
	"templates.defaults.fileImport.title": "Import file (tenants, leases & more)",
	"templates.defaults.fileImport.content":
		"Analyze the attached file and import all contained data into ImmoBase. Proceed as follows:\n" +
		"1. Get an overview of the structure and content of the file.\n" +
		"2. Use the *_list tools to check which referenced records (e.g. properties, units, tenants) already exist and reuse their IDs instead of creating duplicates.\n" +
		"3. Create all missing records with the appropriate *_create tools and link them correctly (e.g. tenant and lease to the right unit).\n" +
		"4. Finally, summarize briefly: what was created, what already existed, what could not be imported (and why)?",
	"templates.defaults.arrears.title": "Outstanding payment arrears",
	"templates.defaults.arrears.content":
		"Create an overview of all open and overdue payments (rent payments and housing charges), grouped by property. For each item, state the tenant or owner, the unit, the due date and the outstanding amount. Finish with the total sum of all arrears.",
	"templates.defaults.vacancies.title": "Vacancy overview",
	"templates.defaults.vacancies.content":
		"List all units that are currently not rented out: property, unit name, living space and since when the unit has been vacant (end of the last lease). Finally state the number of affected units.",
	"templates.defaults.leaseExpiry.title": "Check expiring leases",
	"templates.defaults.leaseExpiry.content":
		"Check all leases: which expire within the next six months or have already ended? List them with tenant, unit, property and end date, sorted by end date, and point out leases for which no follow-up lease exists yet.",
	"templates.defaults.meetingPrep.title": "Prepare owners' meeting (HOA)",
	"templates.defaults.meetingPrep.content":
		"Help me prepare the next owners' meeting: first show for which HOAs meetings are upcoming or have recently taken place, and list this year's resolutions. Then propose an agenda with the usual items (approval of the annual statement, economic plan, status of the reserve fund, maintenance measures, insurances).",
};
