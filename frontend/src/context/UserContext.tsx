import React, { createContext, useContext, useState, useEffect } from "react";
import { CurrentUser, setActiveUser as setApiActiveUser, getActiveUser, apiFetch } from "../services/api";

interface UserContextType {
  currentUser: CurrentUser | null;
  availableUsers: CurrentUser[];
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchUser: (user: CurrentUser) => void;
  refreshUsers: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(getActiveUser());
  const [availableUsers, setAvailableUsers] = useState<CurrentUser[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const fetchUsers = () => {
    apiFetch<{ data: CurrentUser[] }>("/api/users")
      .then((res) => {
        if (res.data) {
          setAvailableUsers(res.data);
        }
      })
      .catch((err) => console.error("Error cargando usuarios:", err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const login = async (email: string, password = "password") => {
    const res = await apiFetch<{ data: { token: string; user: CurrentUser } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const user = res.data.user;
    setCurrentUser(user);
    setApiActiveUser(user, res.data.token);
    fetchUsers();
  };

  const logout = () => {
    setCurrentUser(null);
    setApiActiveUser(null);
  };

  const switchUser = (user: CurrentUser) => {
    setCurrentUser(user);
    setApiActiveUser(user, `koa_token_${user.id}_${Date.now()}`);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, availableUsers, login, logout, switchUser, refreshUsers: fetchUsers, theme, toggleTheme }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
};
