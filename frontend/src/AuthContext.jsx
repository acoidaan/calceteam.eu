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
