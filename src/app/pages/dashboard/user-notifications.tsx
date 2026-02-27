import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { GlassCard, GlassButton } from "../../components/ui/glass-components";
import {
    Bell,
    CheckCheck,
    Trash2
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiFetch } from "../../../lib/api";

interface UserNotificationsPageProps {
    userType?: "user" | "student" | "faculty" | "utility";
}

const UserNotificationsPage: React.FC<UserNotificationsPageProps> = ({ userType = "user" }) => {
    const { showNotification } = useNotification();
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await apiFetch("/notifications/me");
                const formattedNotifications = res.map((notif: any) => ({
                    id: notif.id,
                    title: notif.title,
                    message: notif.message,
                    time: new Date(notif.created_at + (notif.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString(),
                    type: notif.type,
                    read: notif.read,
                    profile_url: notif.profile_url || null
                }));
                setNotifications(formattedNotifications);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            }
        };

        fetchNotifications();
    }, []);

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
            console.error("Error deleting notification:", error);
            showNotification("Failed to remove notification", "error");
        }
    };

    return (
        <DashboardLayout userType={userType}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Notifications</h2>
                        <p className="text-slate-400">View your recent activities and alerts</p>
                    </div>
                    <div className="flex gap-2">
                        <GlassButton onClick={markAllRead} className="flex items-center gap-2">
                            <CheckCheck className="h-4 w-4" />
                            Mark all read
                        </GlassButton>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    {notifications.map((notification) => (
                        <GlassCard key={notification.id} className={`transition-opacity duration-200 opacity-100 border-l-4 border-l-blue-500`}>
                            <div className="flex items-start gap-4">
                                {notification.profile_url ? (
                                    <img src={notification.profile_url} alt="Profile" className="h-11 w-11 rounded-full object-cover shrink-0 ring-1 ring-white/10" />
                                ) : (
                                    <div className="rounded-full bg-white/5 p-3 ring-1 ring-white/10 shrink-0">
                                        <Bell className="h-5 w-5 text-blue-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h4 className={`text-base font-semibold text-white`}>
                                                {notification.title}
                                            </h4>
                                            <p className="mt-1 text-sm text-slate-400">{notification.message}</p>
                                        </div>
                                        <span className="shrink-0 text-xs text-slate-500">{notification.time}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 hidden">
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

                    {notifications.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="rounded-full bg-white/5 p-4 ring-1 ring-white/10 mb-4">
                                <Bell className="h-8 w-8 text-slate-600" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-300">No notifications found</h3>
                            <p className="text-slate-500 max-w-sm mt-1">You have no recent activity.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default UserNotificationsPage;
