import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.MODE === "development" ? "http://localhost:5002/api" : "https://chatapp-full-stack-3-i5hv.onrender.com/api",
  withCredentials: true,
});