import Link from "next/link";
import { MessagesSquare, Wrench } from "lucide-react";

import { getUnitWithPropertyName, listTickets, listUnitsByLabel } from "@/data/tickets";
import { listTicketMessageCounts } from "@/data/ticket-messages";
import { getProperty, listProperties } from "@/data/properties";
import type { TicketStatus } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { TicketFormDialog } from "@/components/tickets/ticket-form-dialog";
import { TicketStatusSelect } from "@/components/tickets/ticket-status-select";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

import { deleteTicketAction } from "./actions";

export const dynamic = "force-dynamic";

const columns: TicketStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; unitId?: string }> }) {
	const t = await getT();
	const { propertyId, unitId } = await searchParams;

	const ticketList = listTickets({ propertyId, unitId });
	// Anzahl der Verlauf-Einträge (E-Mails + Notizen) je Ticket für die Badges.
	const messageCounts = listTicketMessageCounts();
	// Picker-Listen alphabetisch (bisher: SQL ORDER BY name/label ASC).
	const propertyList = listProperties().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnitsByLabel();
	const filteredProperty = propertyId ? getProperty(propertyId) : null;
	const filteredUnit = unitId ? getUnitWithPropertyName(unitId) : null;

	const filterLabel = filteredUnit ? `${filteredUnit.propertyName} – ${filteredUnit.label}` : filteredProperty ? filteredProperty.name : null;

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("tickets.title")} description={t("tickets.description")} actions={<TicketFormDialog properties={propertyList} units={unitList} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{filterLabel ? (
					<p className="text-sm text-muted-foreground">
						{t("tickets.filteredBy")} <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
						<Link href="/tickets" className="text-primary hover:underline">
							{t("common.resetFilters")}
						</Link>
					</p>
				) : null}

				{ticketList.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
							<Wrench className="size-8" />
							<p>{t("tickets.empty")}</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 lg:grid-cols-3">
						{columns.map((status) => {
							const columnTickets = ticketList.filter((ticket) => ticket.status === status);
							return (
								<div key={status} className="flex flex-col gap-3">
									<div className="flex items-center justify-between px-1">
										<h2 className="text-sm font-semibold text-muted-foreground">{t(`tickets.status.${status}`)}</h2>
										<Badge variant="secondary">{columnTickets.length}</Badge>
									</div>

									<div className="flex flex-col gap-3">
										{columnTickets.length === 0 ? (
											<div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{t("tickets.emptyColumn")}</div>
										) : (
											columnTickets.map((ticket) => (
												<Card key={ticket.id}>
													<CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
														<CardTitle className="text-sm font-medium leading-snug">
															<Link href={`/tickets/${ticket.id}`} className="hover:text-primary hover:underline">
																{ticket.title}
															</Link>
														</CardTitle>
														<div className="flex items-center gap-0.5">
															<TicketFormDialog ticket={ticket} properties={propertyList} units={unitList} />
															<ConfirmDeleteButton action={deleteTicketAction.bind(null, ticket.id)} confirmMessage={t("tickets.confirm.delete", { title: ticket.title })} />
														</div>
													</CardHeader>
												<CardContent className="flex flex-col gap-3">
													<p className="text-xs text-muted-foreground">
														{ticket.property ? (
															<Link href={`/liegenschaften#property-${ticket.property.id}`} className="hover:text-foreground hover:underline">
																{ticket.property.name}
															</Link>
														) : (
															t("tickets.fields.noProperty")
														)}
														{ticket.unit ? (
																<>
																	{" · "}
																	<Link href={`/einheiten#unit-${ticket.unit.id}`} className="hover:text-foreground hover:underline">
																		{ticket.unit.label}
																	</Link>
																</>
															) : null}
														</p>
														{ticket.description ? <p className="text-sm text-muted-foreground line-clamp-3">{ticket.description}</p> : null}
														<div className="flex items-center justify-between gap-2">
															<span className="flex items-center gap-2 text-xs text-muted-foreground">
																{formatDate(ticket.createdAt)}
																{(messageCounts[ticket.id] ?? 0) > 0 ? (
																	<Link
																		href={`/tickets/${ticket.id}`}
																		className="inline-flex items-center gap-1 rounded-md hover:text-foreground"
																		title={t("tickets.actions.showHistory")}
																	>
																		<MessagesSquare className="size-3.5" />
																		{messageCounts[ticket.id]}
																	</Link>
																) : null}
															</span>
															<div className="w-36">
																<TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
															</div>
														</div>
													</CardContent>
												</Card>
											))
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
