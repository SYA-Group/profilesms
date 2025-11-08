import axios from "axios";

const API_URL = "https://144.76.215.158:5001/api";


const api = axios.create({
  baseURL: API_URL,
});

// 🔹 Automatically attach token if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- AUTH ----------

// Login user
export const login = async (username: string, password: string) => {
  const res = await api.post("/auth/login", { username, password });
  return res.data;
};

// ✅ Fetch logged-in user info
export const getUserInfo = async () => {
  const res = await api.get("/auth/me");
  return res.data;
};

// ✅ Register new user (admin only) — now includes company_type
export const registerUser = async (data: any) => {
  // Ensure company_type is passed, even if empty
  const payload = {
    ...data,
    company_type: data.company_type || "",
  };
  const res = await api.post("/auth/register", payload);
  return res.data;
};

// Change password
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

// Forgot password
export const forgotPassword = async (email: string) => {
  const res = await api.post("/auth/forgot-password", { email });
  return res.data;
};

// Reset password
export const resetPassword = async (token: string, new_password: string) => {
  const res = await api.post(`/auth/reset-password/${token}`, { new_password });
  return res.data;
};

// ---------- DASHBOARD ----------
export const getDashboardStats = async () => {
  const res = await api.get("/dashboard/stats");
  return res.data;
};

// ---------- CONTACTS ----------
export const getContacts = async () => {
  const res = await api.get("/contacts");
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

// ---------- SMS ----------
export const sendBulkSMS = async (data: { message: string }) => {
  const res = await api.post("/sms/send", data);
  return res.data;
};

// ---------- UPLOAD ----------
export const uploadContacts = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/upload/contacts", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

// ---------- EMAIL ----------
export const updateEmail = async (email: string) => {
  const res = await api.post("/auth/update-email", { email });
  return res.data;
};

// ---------- SUPPORT ----------
export const sendSupportMessage = async (data: { message: string }) => {
  const res = await api.post("/support/contact", data);
  return res.data;
};

// ---------- USERS (Admin only) ----------

// Get all users
export const getUsers = async () => {
  const res = await api.get("/users/list");
  return res.data;
};

// Get single user
export const getUser = async (id: number) => {
  const res = await api.get(`/users/${id}`);
  return res.data;
};

// Update user (email, quota, admin)
export const updateUser = async (
  id: number,
  data: {
    email?: string;
    sms_quota?: number;
    is_admin?: number;
    company_type?: string; // ✅ new optional field
  }
) => {
  const res = await api.put(`/users/${id}`, data);
  return res.data;
};


// Reset user password
export const resetUserPassword = (id: number, newPassword: string) =>
  api.post(`/users/${id}/reset-password`, { new_password: newPassword });

// Delete user
export const deleteUser = async (id: number) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};

// Suspend user
export const suspendUser = (id: number, suspended: boolean) =>
  api.put(`/users/${id}/suspend`, { suspended });

// ---------- ERROR HANDLING ----------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } else {
      console.error("API Error:", error.response?.data || error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
