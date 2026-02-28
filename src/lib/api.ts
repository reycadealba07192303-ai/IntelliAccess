// lib/api.ts
export const API_BASE_URL = 'https://unemptied-unsurrealistically-danyel.ngrok-free.dev';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    // Get token from localStorage (assuming we store it there on login)
    const token = localStorage.getItem('access_token');

    const headers: Record<string, string> = {
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
