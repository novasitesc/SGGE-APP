import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { LoteProvider } from "@/components/lotes/LoteProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LoteProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </LoteProvider>
  );
}
