// lib/api.ts
// In production, use VITE_API_URL (Render, etc.).
// For fast local development, prefer local backend settings:
// - VITE_USE_LOCAL_API=true (force local)
// - VITE_LOCAL_API_URL=http://localhost:8000 (optional custom local URL)
// - VITE_PI_API_URL=http://192.168.1.5:8000 (default Raspberry Pi backend URL)
// Default is Raspberry Pi backend on 192.168.1.5:8000.
const DEFAULT_LOCAL_API_URL = import.meta.env.VITE_PI_API_URL || `http://192.168.1.5:8000`;

const shouldUseLocal = import.meta.env.VITE_USE_LOCAL_API === 'true';
const localUrl = import.meta.env.VITE_LOCAL_API_URL || DEFAULT_LOCAL_API_URL;

const piUrl = import.meta.env.VITE_PI_API_URL;
const apiUrl = import.meta.env.VITE_API_URL;

// Force production URL if running on Vercel and env vars are missing
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes("vercel.app");
const PRODUCTION_URL = "https://api.intelliaccess.online";

// If we have a Pi URL (especially an Ngrok one), prioritize it as it's our hardware backend
let finalUrl = (piUrl && piUrl.includes("ngrok")) ? piUrl : (apiUrl || piUrl || DEFAULT_LOCAL_API_URL);

if (isVercel && !apiUrl) {
    finalUrl = PRODUCTION_URL;
}

/**
 * Ensures that Ngrok URLs use HTTPS to avoid Mixed Content errors on Vercel.
 */
export function getSecureUrl(url: string | undefined) {
    if (!url) return "";
    let secureUrl = url;
    
    // Auto-upgrade ngrok to https to prevent Mixed Content errors on Vercel
    if (url.includes("ngrok") && url.startsWith("http://")) {
        secureUrl = url.replace("http://", "https://");
    }
    
    return secureUrl;
}

export const API_BASE_URL = getSecureUrl(finalUrl);

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
