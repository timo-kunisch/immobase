import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function SiteHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
	return (
		<header className="flex flex-col gap-4 border-b bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<div className="flex items-center gap-3">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="h-6" />
				<div>
					<h1 className="text-lg font-semibold tracking-tight">{title}</h1>
					{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
				</div>
			</div>
			{actions ? <div className="flex items-center gap-2">{actions}</div> : null}
		</header>
	);
}
