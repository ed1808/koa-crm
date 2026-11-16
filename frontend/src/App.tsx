import React, { useState, useEffect } from "react";
import { UserProvider, useUser } from "./context/UserContext";
import { Navbar, AppTab } from "./components/Navbar";
import { LoginPage } from "./pages/LoginPage";
import { DealsKanbanPage } from "./pages/DealsKanbanPage";
import { TicketsKanbanPage } from "./pages/TicketsKanbanPage";
import { TasksTablePage } from "./pages/TasksTablePage";
import { CompaniesContactsPage } from "./pages/CompaniesContactsPage";
import { ErpEventsPage } from "./pages/ErpEventsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { RecordDrawer } from "./components/RecordDrawer";
import { CopilotDrawer } from "./components/CopilotDrawer";

function AppContent() {
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<AppTab>("deals");

  // State for Record Drawer (360° detail view)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedRecordType, setSelectedRecordType] = useState<"DEAL" | "TICKET">("DEAL");
  const [isRecordDrawerOpen, setIsRecordDrawerOpen] = useState(false);

  // State for AI Copilot Drawer
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotTicketId, setCopilotTicketId] = useState<string | null>(null);
  const [copilotDealId, setCopilotDealId] = useState<string | null>(null);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);

  // TODOS los hooks deben llamarse incondicionalmente antes de cualquier return anticipado
  useEffect(() => {
    if (currentUser && (currentUser.role === "CLIENTE" || currentUser.role === "PROVEEDOR")) {
      setActiveTab("tickets");
    } else if (currentUser && currentUser.role !== "ADMIN" && activeTab === "settings") {
      setActiveTab("deals");
    }
  }, [currentUser?.role, activeTab]);

  // Si no hay sesión iniciada, mostrar la pantalla de Login
  if (!currentUser) {
    return <LoginPage />;
  }

  const handleOpenDealDrawer = (dealId: string) => {
    setSelectedRecordId(dealId);
    setSelectedRecordType("DEAL");
    setIsRecordDrawerOpen(true);
  };

  const handleOpenTicketDrawer = (ticketId: string) => {
    setSelectedRecordId(ticketId);
    setSelectedRecordType("TICKET");
    setIsRecordDrawerOpen(true);
  };

  const handleOpenCopilotForTicket = (ticketId: string) => {
    setCopilotTicketId(ticketId);
    setCopilotDealId(null);
    setIsCopilotOpen(true);
  };

  const handleOpenCopilotForDeal = (dealId: string) => {
    setCopilotDealId(dealId);
    setCopilotTicketId(null);
    setIsCopilotOpen(true);
  };

  const handleOpenGeneralCopilot = () => {
    setCopilotTicketId(null);
    setCopilotDealId(null);
    setIsCopilotOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenCopilot={handleOpenGeneralCopilot}
      />

      {/* Main Work Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "deals" && (
          <DealsKanbanPage
            onSelectDeal={handleOpenDealDrawer}
            onOpenCopilotWithDeal={handleOpenCopilotForDeal}
            refreshKey={boardRefreshKey}
          />
        )}

        {activeTab === "tickets" && (
          <TicketsKanbanPage
            onSelectTicket={handleOpenTicketDrawer}
            onOpenCopilotWithTicket={handleOpenCopilotForTicket}
            refreshKey={boardRefreshKey}
          />
        )}

        {activeTab === "tasks" && <TasksTablePage />}

        {activeTab === "companies" && <CompaniesContactsPage />}

        {activeTab === "erp" && <ErpEventsPage />}

        {activeTab === "settings" && currentUser.role === "ADMIN" && <AdminSettingsPage />}
      </main>

      {/* 360° Record Drawer */}
      <RecordDrawer
        isOpen={isRecordDrawerOpen}
        onClose={() => setIsRecordDrawerOpen(false)}
        recordType={selectedRecordType}
        recordId={selectedRecordId}
        onOpenCopilotWithContext={(id, type) => {
          if (type === "TICKET") handleOpenCopilotForTicket(id);
          else handleOpenCopilotForDeal(id);
        }}
        onRecordUpdated={() => setBoardRefreshKey((k) => k + 1)}
      />

      {/* Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeTicketId={copilotTicketId}
        activeDealId={copilotDealId}
        onRefreshData={() => setBoardRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
