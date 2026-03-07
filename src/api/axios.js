import axios from 'axios';

// ✅ LOCAL BACKEND URL
const API_BASE_URL = "http://localhost:5000/api";

// ✅ Use local URL if env not present
const API_URL = import.meta.env.VITE_API_URL || API_BASE_URL;

console.log('🌐 API Base URL:', API_URL);

const instance = axios.create({
  baseURL: API_URL,
});

// Token interceptor
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default instance;