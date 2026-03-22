// lib/api.ts
// In production, use VITE_API_URL (Render, etc.).
// For fast local development, prefer local backend settings:
// - VITE_USE_LOCAL_API=true (force local)
// - VITE_LOCAL_API_URL=http://localhost:8000 (optional custom local URL)
// Default is http://<current-hostname>:8000
const DEFAULT_LOCAL_API_URL = `http://${window.location.hostname}:8000`;

const shouldUseLocal = import.meta.env.VITE_USE_LOCAL_API === 'true';
const localUrl = import.meta.env.VITE_LOCAL_API_URL || DEFAULT_LOCAL_API_URL;

export const API_BASE_URL =
  shouldUseLocal ? localUrl :
  import.meta.env.VITE_API_URL || localUrl;

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    // Get token from localStorage (assuming we store it there on login)
    const token = localStorage.getItem('access_token');

    const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
        ...(options.headers as Record<string, string> || {}),
    };

    // Only set Content-Type to JSON if not sending FormData
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `API Error: ${response.statusText}`);
    }

    return response.json();
}
