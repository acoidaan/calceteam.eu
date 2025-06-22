// ==========================================
// INTERCEPTOR HTTP GLOBAL CON REFRESH TOKENS
// ==========================================

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Función para hacer fetch con auto-refresh
export const fetchWithAuth = async (url, options = {}) => {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("No access token available");
  }

  // Añadir token a headers
  const authHeaders = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: authHeaders,
  });

  // Si es 401, intentar refresh
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}));

    // Solo intentar refresh si el error es por token expirado
    if (
      errorData.code === "TOKEN_EXPIRED" ||
      errorData.message?.includes("expirado")
    ) {
      if (isRefreshing) {
        // Si ya se está refrescando, esperar en cola
        console.log("⏳ Esperando en cola de refresh...");
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            const newHeaders = {
              ...options.headers,
              Authorization: `Bearer ${token}`,
            };
            return fetch(url, { ...options, headers: newHeaders });
          })
          .catch((err) => {
            throw err;
          });
      }

      console.log("🔄 Token expirado, iniciando refresh...");
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const refreshResponse = await fetch("/api/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();

          // Guardar nuevos tokens
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);

          console.log("✅ Refresh exitoso, reintentando request");

          // Procesar cola de requests pendientes
          processQueue(null, data.accessToken);

          // Reintentar request original con nuevo token
          const newHeaders = {
            ...options.headers,
            Authorization: `Bearer ${data.accessToken}`,
          };

          return fetch(url, { ...options, headers: newHeaders });
        } else {
          throw new Error("Refresh failed");
        }
      } catch (error) {
        console.error("❌ Error en refresh:", error);

        // Procesar cola con error
        processQueue(error, null);

        // Logout si falla el refresh
        console.log("🚪 Refresh falló, redirigiendo a login...");
        localStorage.clear();
        window.location.href = "/";
        throw error;
      } finally {
        isRefreshing = false;
      }
    }
  }

  return response;
};

// Función auxiliar para requests GET simples
export const getWithAuth = async (url) => {
  return fetchWithAuth(url, { method: "GET" });
};

// Función auxiliar para requests POST
export const postWithAuth = async (url, body, options = {}) => {
  return fetchWithAuth(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...options,
  });
};

// Función auxiliar para requests PUT
export const putWithAuth = async (url, body, options = {}) => {
  return fetchWithAuth(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...options,
  });
};

// Función auxiliar para requests DELETE
export const deleteWithAuth = async (url, options = {}) => {
  return fetchWithAuth(url, {
    method: "DELETE",
    ...options,
  });
};

// Para uploads de archivos (FormData)
export const uploadWithAuth = async (url, formData, options = {}) => {
  return fetchWithAuth(url, {
    method: "POST",
    body: formData, // No añadir Content-Type para FormData
    ...options,
  });
};

// Función para migrar código existente
export const migrateToFetchWithAuth = () => {
  console.warn(`
🔄 MIGRACIÓN NECESARIA:
Para usar el sistema de refresh tokens, reemplaza:

❌ Antes:
const token = localStorage.getItem('token');
const response = await fetch('/api/endpoint', {
  headers: { Authorization: \`Bearer \${token}\` }
});

✅ Después:
import { fetchWithAuth } from './httpInterceptor';
const response = await fetchWithAuth('/api/endpoint');

🎯 También puedes usar helpers específicos:
- getWithAuth('/api/endpoint')
- postWithAuth('/api/endpoint', { data })
- putWithAuth('/api/endpoint', { data })
- deleteWithAuth('/api/endpoint')
- uploadWithAuth('/api/endpoint', formData)
  `);
};
