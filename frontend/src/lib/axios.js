import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_BACKEND_URL || "http://localhost:5002") + "/api",
  withCredentials: true,
});