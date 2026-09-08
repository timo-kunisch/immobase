import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UpdateBanner } from "@/components/layout/update-banner";
import { requireUser } from "@/lib/auth/dal";
import { isSmtpConfigured } from "@/lib/email/mailer";

// Autoritativer Auth-Check für den gesamten geschützten Bereich der App
// (siehe src/proxy.ts für den vorgelagerten, günstigen Cookie-Check).
// requireUser() leitet nicht angemeldete Nutzer zu /login um.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const user = await requireUser();

	return (
		<SidebarProvider>
			<AppSidebar user={{ email: user.email, role: user.role }} smtpConfigured={isSmtpConfigured()} />
			<SidebarInset>
				<UpdateBanner />
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
