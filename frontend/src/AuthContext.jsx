import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verificar auth al cargar la app
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Función para validar formato JWT
  const isValidJWT = (token) => {
    if (!token || typeof token !== "string") return false;
    const parts = token.split(".");
    return parts.length === 3;
  };

  // Función de auto-reparación
  const autoRepair = () => {
    console.log("🔧 Ejecutando auto-reparación...");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    setUser(null);
    setLoading(false);
  };

  // Intento de refresh con mejor manejo de errores
  const attemptRefresh = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken || !isValidJWT(refreshToken)) {
        return false;
      }

      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        const username = localStorage.getItem("username");
        setIsAuthenticated(true);
        setUser({ username });
        scheduleTokenRefresh();
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Error en refresh:", error);
      return false;
    }
  };

  const checkAuthStatus = async () => {
    // Timeout para evitar que se quede colgado
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 10000)
    );

    try {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const username = localStorage.getItem("username");

      // Validación automática de tokens
      if (
        !accessToken ||
        !refreshToken ||
        !username ||
        !isValidJWT(accessToken) ||
        !isValidJWT(refreshToken)
      ) {
        console.log("🔧 Auto-reparando tokens inválidos...");
        autoRepair();
        return;
      }

      console.log("🔍 Verificando access token...");

      // Agregar timeout a la verificación
      const response = await Promise.race([
        fetch("/api/user/profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        timeout,
      ]);

      if (response.ok) {
        console.log("✅ Access token válido");
        setIsAuthenticated(true);
        setUser({ username });
        scheduleTokenRefresh();
      } else if (response.status === 401) {
        console.log("⏰ Intentando refresh automático...");
        const refreshed = await attemptRefresh();
        if (!refreshed) {
          autoRepair();
        }
      } else {
        autoRepair();
      }
    } catch (error) {
      console.error("❌ Error en auth, auto-reparando:", error);
      autoRepair();
    } finally {
      setLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      console.log("❌ No hay refresh token");
      return false;
    }

    try {
      console.log("🔄 Intentando refresh del access token...");
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();

        // Guardar nuevos tokens
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        console.log("✅ Access token renovado exitosamente");
        return true;
      } else {
        console.log("❌ Error renovando token:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ Error en refresh:", error);
      return false;
    }
  };

  const scheduleTokenRefresh = () => {
    // Renovar token 2 minutos antes de que expire (15min - 2min = 13min)
    const refreshTime = (15 - 2) * 60 * 1000; // 13 minutos en ms

    console.log(
      `⏰ Programando renovación de token en ${refreshTime / 1000 / 60} minutos`
    );

    setTimeout(async () => {
      console.log("🔄 Renovando token automáticamente...");
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        console.log("✅ Renovación automática exitosa");
        scheduleTokenRefresh(); // Programar siguiente renovación
      } else {
        console.log("❌ Renovación automática falló, cerrando sesión");
        logout(); // Si falla, hacer logout
      }
    }, refreshTime);
  };

  const login = async (credentials) => {
    try {
      console.log("🔐 Intentando login...");
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Login exitoso");

        // Guardar tokens y usuario
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("username", data.username);

        setIsAuthenticated(true);
        setUser({ username: data.username });

        // Programar renovación automática
        scheduleTokenRefresh();

        return { success: true };
      } else {
        console.log("❌ Login falló:", data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error("❌ Error en login:", error);
      return { success: false, message: "Error de conexión" };
    }
  };

  const logout = async () => {
    console.log("🚪 Cerrando sesión...");

    try {
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken && accessToken.includes(".")) {
        await fetch("/api/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch (error) {
      console.error("❌ Error en logout:", error);
    } finally {
      // SIEMPRE limpiar todo, sin importar errores
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("username");

      setIsAuthenticated(false);
      setUser(null);

      console.log("✅ Sesión cerrada exitosamente");
    }
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
