import axios from "axios";

export const API_BASE = "http://localhost:8080/salon-api/public";
// export const API_BASE = "https://gslweb.gabisanshipping.co/salon-api/public";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT + branch to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  // support both keys (old + new)
  const branchId =
    localStorage.getItem("activeBranchId") ||
    localStorage.getItem("branch_id") ||
    localStorage.getItem("activeBranchId".toLowerCase()) ||
    "";

  config.headers = config.headers ?? {};

  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (branchId) config.headers["X-Branch-Id"] = branchId;

  return config;
});