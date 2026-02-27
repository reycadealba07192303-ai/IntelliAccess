import React, { useState } from "react";
import { GlassCard, GlassButton } from "../../components/ui/glass-components";
import {
    Bell,
    Search,
    CheckCheck,
    Trash2,
    Filter,
    User,
    AlertCircle,
    Info
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiFetch } from "../../../lib/api";

const NotificationsPage = () => {
    const { showNotification } = useNotification();
    const [filter, setFilter] = useState("all");

    // Dummy data
    const [notifications, setNotifications] = useState<any[]>([]);

    React.useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await apiFetch("/notifications/");
                const formattedNotifications = res.map((notif: any) => ({
                    id: notif.id,
                    title: notif.title,
                    message: notif.message,
                    time: new Date(notif.created_at + (notif.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString(),
                    type: notif.type || "system",
                    read: notif.read || true,
                    profile_url: notif.profile_url || null
                }));
                setNotifications(formattedNotifications);
            } catch (error) {
                console.error("Error fetching admin notifications:", error);
            }
        };

        fetchNotifications();
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case "user": return <User className="h-5 w-5 text-blue-400" />;
            case "alert": return <AlertCircle className="h-5 w-5 text-red-400" />;
            case "system": return <Info className="h-5 w-5 text-purple-400" />;
            default: return <Bell className="h-5 w-5 text-emerald-400" />;
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === "all") return true;
        if (filter === "unread") return !n.read;
        return n.type === filter;
    });

    const markAllRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
        showNotification("All notifications marked as read", "success");
    };

    const deleteNotification = async (id: string) => {
        try {
            await apiFetch(`/notifications/${id}`, { method: "DELETE" });
            setNotifications(notifications.filter(n => n.id !== id));
            showNotification("Notification removed", "info");
        } catch (error) {
            console.error("Failed to delete notification", error);
            showNotification("Failed to delete notification", "error");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Notifications</h2>
                    <p className="text-slate-400">Manage and view system alerts and updates</p>
                </div>
                <div className="flex gap-2">
                    <GlassButton onClick={markAllRead} className="flex items-center gap-2">
                        <CheckCheck className="h-4 w-4" />
                        Mark all read
                    </GlassButton>
                </div>
            </div>

            {/* Filters and Search */}
            <GlassCard className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {["all", "unread", "user", "system", "alert"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filter === f
                                    ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-600/40"
                                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50 md:w-64"
                        />
                    </div>
                </div>
            </GlassCard>

            {/* Notifications List */}
            <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                    <GlassCard key={notification.id} className={`transition-opacity duration-200 ${notification.read ? "opacity-75" : "opacity-100 border-l-4 border-l-blue-500"}`}>
                        <div className="flex items-start gap-4">
                            {notification.profile_url ? (
                                <img src={notification.profile_url} alt="Profile" className="h-11 w-11 rounded-full object-cover shrink-0 ring-1 ring-white/10" />
                            ) : (
                                <div className="rounded-full bg-white/5 p-3 ring-1 ring-white/10 shrink-0">
                                    {getIcon(notification.type)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className={`text-base font-semibold ${notification.read ? "text-slate-300" : "text-white"}`}>
                                            {notification.title}
                                        </h4>
                                        <p className="mt-1 text-sm text-slate-400">{notification.message}</p>
                                    </div>
                                    <span className="shrink-0 text-xs text-slate-500">{notification.time}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    onClick={() => deleteNotification(notification.id)}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                ))}

                {filteredNotifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-white/5 p-4 ring-1 ring-white/10 mb-4">
                            <Bell className="h-8 w-8 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-300">No notifications found</h3>
                        <p className="text-slate-500 max-w-sm mt-1">There are no notifications matching your current filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
