import React from "react";
import { useUser } from "../context/UserContext";
import { 
  Briefcase, 
  LifeBuoy, 
  CheckSquare, 
  Building2, 
  Activity, 
  Settings,
  Sun, 
  Moon, 
  Sparkles, 
  ShieldCheck,
  ChevronDown,
  LogOut
} from "lucide-react";

export type AppTab = "deals" | "tickets" | "tasks" | "companies" | "erp" | "settings";

interface NavbarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenCopilot: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, onOpenCopilot }) => {
  const { currentUser, availableUsers, switchUser, logout, theme, toggleTheme } = useUser();

  if (!currentUser) return null;

  const isClient = currentUser.role === "CLIENTE";
  const isProvider = currentUser.role === "PROVEEDOR";
  const isAdmin = currentUser.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        
        {/* Logo & Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange("deals")}>
            <div className="w-8 h-8 rounded-lg bg-brand-900 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              K
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 dark:text-white leading-tight text-sm tracking-wide">
                KOA CRM
              </span>
              <span className="text-[10px] text-brand-700 dark:text-brand-500 font-medium">
                Service Desk & AI
              </span>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="flex items-center gap-1">
            {!isClient && !isProvider && (
              <button
                onClick={() => onTabChange("deals")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "deals"
                    ? "bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Comercial
              </button>
            )}

            <button
              onClick={() => onTabChange("tickets")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "tickets"
                  ? "bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Soporte
            </button>

            {!isClient && (
              <button
                onClick={() => onTabChange("tasks")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "tasks"
                    ? "bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Tareas
              </button>
            )}

            {!isClient && !isProvider && (
              <button
                onClick={() => onTabChange("companies")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "companies"
                    ? "bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Empresas & Contactos
              </button>
            )}

            {!isClient && !isProvider && (
              <button
                onClick={() => onTabChange("erp")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "erp"
                    ? "bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Eventos ERP
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => onTabChange("settings")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "settings"
                    ? "bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-200 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                Configuración
              </button>
            )}
          </nav>
        </div>

        {/* Right Section: AI Copilot, Theme toggle, and RBAC Switcher */}
        <div className="flex items-center gap-3">
          {/* AI Copilot Button */}
          {!isClient && (
            <button
              onClick={onOpenCopilot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-medium shadow-sm transition-all hover:shadow active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Copiloto IA</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* User Profile / Switcher Dropdown */}
          <div className="relative group">
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-900 dark:text-brand-200 flex items-center justify-center text-xs font-bold border border-brand-200 dark:border-brand-800">
                {currentUser.full_name.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                  {currentUser.full_name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-brand-600" />
                  {currentUser.role}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
            </div>

            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-2 hidden group-hover:block z-50">
              <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Cambiar de Usuario
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => switchUser(u)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex flex-col transition-colors ${
                      u.id === currentUser.id
                        ? "bg-brand-50 dark:bg-brand-950 text-brand-900 dark:text-brand-300 font-medium"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-medium truncate">{u.full_name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{u.role} · {u.department || "General"}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};
