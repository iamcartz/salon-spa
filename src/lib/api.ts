import axios from "axios";

export const API_BASE = "http://localhost:8080/salon-api/public";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT + active branch to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const branchId = localStorage.getItem("activeBranchId"); // FIXED

  config.headers = config.headers ?? {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (branchId) {
    config.headers["X-Branch-Id"] = branchId;
  }

  return config;
});