import axios from "axios";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true, // send the httpOnly refresh-token cookie
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// On a 401, try exactly once to refresh the access token before giving up —
// this keeps a user's session alive across the 15-minute access-token
// expiry without asking them to log in again every quarter hour.
let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;

      refreshPromise =
        refreshPromise ??
        apiClient
          .post("/auth/refresh")
          .then((res) => {
            const token = res.data.accessToken as string;
            setAccessToken(token);
            return token;
          })
          .catch(() => null)
          .finally(() => {
            refreshPromise = null;
          });

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  }
);
