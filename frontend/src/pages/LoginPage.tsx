import React, { useState } from "react";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, Building2, User } from "lucide-react";
import { useUser } from "../context/UserContext";

export const LoginPage: React.FC = () => {
  const { login, availableUsers } = useUser();
  const [email, setEmail] = useState("admin@koa.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (userEmail: string) => {
    setEmail(userEmail);
    setPassword("123456");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-900/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 relative z-10">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-brand-900 text-white items-center justify-center font-bold text-2xl shadow-lg shadow-brand-900/30 mb-1">
            K
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            KOA CRM & Service Desk
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ingresa tus credenciales para acceder a la plataforma corporativa
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@koa.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-md shadow-brand-900/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            <span>{loading ? "Iniciando sesión..." : "Iniciar Sesión"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Access Credentials */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            Acceso Rápido por Rol (Demostración)
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickSelect("admin@koa.com")}
              className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-brand-600" /> Admin
              </div>
              <div className="text-[10px] text-slate-500 truncate">admin@koa.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSelect("rafael.betancourt@koa.com")}
              className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                <User className="w-3 h-3 text-emerald-600" /> Comercial
              </div>
              <div className="text-[10px] text-slate-500 truncate">rafael.betancourt@...</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSelect("cristi.ruiz@koa.com")}
              className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" /> Soporte
              </div>
              <div className="text-[10px] text-slate-500 truncate">cristi.ruiz@...</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSelect("claudia.otalvaro@acuagas.com")}
              className="p-2 text-left bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-600" /> Cliente
              </div>
              <div className="text-[10px] text-slate-500 truncate">claudia.otalvaro@...</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
