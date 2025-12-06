import axios from "axios";

const API_URL = "https://profilesms.duckdns.org:5001/api";

const api = axios.create({
  baseURL: API_URL,
});

// --------------------------------------------
// 🔵 REQUEST INTERCEPTOR — attach access token
// --------------------------------------------
api.interceptors.request.use((config) => {
  const PUBLIC_ENDPOINTS = [
    "auth/login",
    "auth/register",
    "support/lead",
    "support/contact",
    "pricing"
  ];

  const cleanUrl = (config.url || "").replace(/^\//, "");

  

  // Public endpoints → DO NOT attach token
  if (PUBLIC_ENDPOINTS.some((p) => cleanUrl.startsWith(p))) {
    return config;
  }

  // Attach token normally
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  if (token && token !== "null" && token !== "undefined") {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// --------------------------------------------
// 🔵 RESPONSE INTERCEPTOR — token refresh
// --------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || "";
        // ----------------------------------------------------
    // 🔴 SUSPENDED USER HANDLING
    // ----------------------------------------------------
    const suspended =
      status === 403 &&
      (
        error.response?.data?.error?.toLowerCase().includes("suspended") ||
        error.response?.data?.error === "Account suspended"
      );

    if (suspended) {
      // 1️⃣ Remove tokens
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      sessionStorage.clear();

      // 2️⃣ Clear cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie =
          c.replace(/^ +/, "")
            .replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
      });

      // 3️⃣ Clear cache
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }

      // 4️⃣ Redirect to suspended page
      window.location.href = "/suspended";
      return;
    }


    // Skip refresh on auth endpoints
    if (
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    // Unauthorized → attempt refresh
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken =
        localStorage.getItem("refresh_token") ||
        sessionStorage.getItem("refresh_token");

      if (!refreshToken) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers["Authorization"] =
              "Bearer " + newToken;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });

        const newAccessToken = res.data.access_token;

        if (localStorage.getItem("refresh_token")) {
          localStorage.setItem("token", newAccessToken);
        } else {
          sessionStorage.setItem("token", newAccessToken);
        }

        api.defaults.headers.common["Authorization"] =
          "Bearer " + newAccessToken;

        processQueue(null, newAccessToken);

        originalRequest.headers["Authorization"] =
          "Bearer " + newAccessToken;

        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ----------------------------------------------------
// API FUNCTIONS (unchanged) — everything works the same
// ----------------------------------------------------

export const login = async (username: string, password: string) => {
  const res = await api.post("/auth/login", { username, password });
  return res.data;
};

export const getUserInfo = async () => {
  const res = await api.get("/auth/me");
  return res.data;
};

export const registerUser = async (data: any) => {
  const payload = {
    ...data,
    company_type: data.company_type || "",
  };
  const res = await api.post("/auth/register", payload);
  return res.data;
};

export const changePassword = async (
  current_password: string,
  new_password: string
) => {
  const res = await api.post("/auth/change-password", {
    current_password,
    new_password,
  });
  return res.data;
};

export const forgotPassword = async (email: string) => {
  const res = await api.post("/auth/forgot-password", { email });
  return res.data;
};

export const resetPassword = async (token: string, new_password: string) => {
  const res = await api.post(`/auth/reset-password/${token}`, {
    new_password,
  });
  return res.data;
};

export const getDashboardStats = async () => {
  const res = await api.get("/dashboard/stats");
  return res.data;
};

export const getContacts = async ({ page = 1, limit = 50 }) => {
  const res = await api.get(`/contacts?page=${page}&limit=${limit}`);
  return res.data;
};


export const deleteContact = async (id: number) => {
  const res = await api.delete(`/contacts/${id}`);
  return res.data;
};

export const addContact = async (data: { name: string; phone: string }) => {
  const res = await api.post("/contacts", data);
  return res.data;
};

export const sendBulkSMS = async (data: { message: string }) => {
  const res = await api.post("/sms/send", data);
  return res.data;
};

export const resendMessages = async (status: string) => {
  const res = await api.post("/sms/resend", { status });
  return res.data;
};

export const uploadContacts = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post("/upload/contacts", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const updateEmail = async (email: string) => {
  const res = await api.post("/auth/update-email", { email });
  return res.data;
};

export const sendSupportMessage = async (data: { message: string }) => {
  const res = await api.post("/support/contact", data);
  return res.data;
};

export const getUsers = async () => {
  const res = await api.get("/users/list");
  return res.data;
};

export const getUser = async (id: number) => {
  const res = await api.get(`/users/${id}`);
  return res.data;
};

export const updateUser = async (id: number, data: any) => {
  const res = await api.put(`/users/${id}`, data);
  return res.data;
};

export const resetUserPassword = (id: number, newPassword: string) =>
  api.post(`/users/${id}/reset-password`, { new_password: newPassword });

export const deleteUser = async (id: number) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};

export const suspendUser = (id: number, suspended: boolean) =>
  api.put(`/users/${id}/suspend`, { suspended });

export const getPricing = async () => {
  const res = await api.get("/pricing");
  return res.data;
};

export const updatePricing = async (id: number, data: any) => {
  const res = await api.put(`/pricing/${id}`, data);
  return res.data;
};

export const deletePricing = async (id: number) => {
  const res = await api.delete(`/pricing/${id}`);
  return res.data;
};

export const searchCount = async (
  query: string,
  governorate?: string,
  gender?: string,
  birthdate?: string,
  phone_key?: string,
  city?: string,
  address?: string,
  work?: string,
  studied?: string,
  religion?: string,
  relation?: string,
  job?: string
) => {
  const params = new URLSearchParams();
  params.set("q", query);

  if (governorate) params.set("governorate", governorate);
  if (gender) params.set("gender", gender);
  if (birthdate) params.set("birthdate", birthdate);
  if (phone_key) params.set("phone_key", phone_key);

  if (city) params.set("city", city);
  if (address) params.set("address", address);
  if (work) params.set("work", work);
  if (studied) params.set("studied", studied);
  if (religion) params.set("religion", religion);
  if (relation) params.set("relation", relation);
  if (job) params.set("job", job);

  const res = await api.get(`/search/count?${params.toString()}`);
  return res.data;
};

export const searchPreview = async (
  query: string,
  limit: number = 20,
  governorate?: string,
  gender?: string,
  birthdate?: string,
  phone_key?: string,
  city?: string,
  address?: string,
  work?: string,
  studied?: string,
  religion?: string,
  relation?: string,
  job?: string
) => {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", String(limit));

  if (governorate) params.set("governorate", governorate);
  if (gender) params.set("gender", gender);
  if (birthdate) params.set("birthdate", birthdate);
  if (phone_key) params.set("phone_key", phone_key);

  if (city) params.set("city", city);
  if (address) params.set("address", address);
  if (work) params.set("work", work);
  if (studied) params.set("studied", studied);
  if (religion) params.set("religion", religion);
  if (relation) params.set("relation", relation);
  if (job) params.set("job", job);

  const res = await api.get(`/search/preview?${params.toString()}`);
  return res.data;
};

export const sendSearchSMS = async (data: any) => {
  const res = await api.post("/search/send", data);
  return res.data;
};

export const createPricing = async (body: any) => {
  const res = await api.post("/pricing", body);
  return res.data;
};

export const updatePricingPlan = async (id: number, body: any) => {
  const res = await api.put(`/pricing/${id}`, body);
  return res.data;
};

export const deletePricingPlan = async (id: number) => {
  const res = await api.delete(`/pricing/${id}`);
  return res.data;
};

export const getSmsProgress = async () => {
  const res = await api.get("/search/progress");
  return res.data;
};

export const getUnreadNotifications = () =>
  api.get("/notifications/unread");

export const markNotificationsRead = () =>
  api.post("/notifications/mark_all_read");

export const sendLeadMessage = async (data: any) => {
  return api.post("/support/lead", data);
};



export const topupSMS = async (userId: number, amount: number) => {
  const res = await api.post(`/users/${userId}/topup`, { amount });
  return res.data;
};
export const getUploadedContacts = async () => {
  const res = await api.get("/upload/contacts");
  return res.data;
};

// ADD CONTACT INTO uploaded_contact TABLE
export const addUploadedContact = async (data: { name: string; phone: string }) => {
  const res = await api.post("upload/add", data);
  return res.data;
};

// =====================================================
// ✅ UPLOAD SMS API (NON-BREAKING ADDITION)
// =====================================================

export const sendUploadSMS = async (data: { message: string }) => {
  const res = await api.post("/upload/sms/send", data);
  return res.data;
};

export const stopUploadSMS = async () => {
  const res = await api.post("/upload/sms/stop");
  return res.data;
};

export const getUploadSMSProgress = async () => {
  const res = await api.get("/upload/sms/progress");
  return res.data;
};

export const sendLeadSupportMessage = (data: any) =>
  axios.post("/api/support/lead", data);


export default api;
