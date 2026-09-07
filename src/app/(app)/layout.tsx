import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { requireUser } from "@/lib/auth/dal";

// Autoritativer Auth-Check für den gesamten geschützten Bereich der App
// (siehe middleware.ts für den vorgelagerten, günstigen Cookie-Check).
// requireUser() leitet nicht angemeldete Nutzer zu /login um.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const user = await requireUser();

	return (
		<SidebarProvider>
			<AppSidebar user={{ email: user.email, role: user.role }} />
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	);
}
