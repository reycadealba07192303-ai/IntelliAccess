// lib/api.ts
// In production, use the environment variable (e.g. your Render URL). 
// In local development, dynamically use the current host so that local network devices (like phones) can access the backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

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
