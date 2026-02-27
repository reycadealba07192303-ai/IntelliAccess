import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { GlassCard } from "../../components/ui/glass-components";
import { Search, Calendar, MapPin, Download, Eye, X } from "lucide-react";
import { motion } from "motion/react";
import { apiFetch, API_BASE_URL } from "@/lib/api";

interface AccessLog {
    id: string;
    created_at: string;
    gate: string;
    action: string;
    status: string;
    plate_detected: string;
    image_url?: string;
}

interface UserLogsPageProps {
    userType?: "user" | "student" | "faculty" | "utility";
}

const UserLogsPage: React.FC<UserLogsPageProps> = ({ userType = "user" }) => {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("All Status");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const fetchMyLogs = async () => {
        setIsLoading(true);
        try {
            const data = await apiFetch('/logs/me');
            setLogs(data as any);
        } catch (error) {
            console.error("Error fetching my logs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMyLogs();
    }, []);

    // Group logs into sessions (Time In / Time Out)
    const groupedSessions = React.useMemo(() => {
        const sessions: any[] = [];
        const openSessions: Record<string, any> = {};

        const sortedLogs = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        sortedLogs.forEach(log => {
            const dateStr = new Date(log.created_at).toLocaleDateString();
            const plate = log.plate_detected || "Unknown";
            const gate = log.gate?.replace('_', ' ') || "Unknown";
            const key = `${plate}-${dateStr}`;

            if (log.action === 'Entry' || log.action === 'ENTRY') {
                if (!openSessions[key]) {
                    openSessions[key] = {
                        id: log.id,
                        plate: plate,
                        gate: gate,
                        status: log.status,
                        date: dateStr,
                        time_in: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        time_out: "--",
                        created_at: log.created_at,
                        image_url: log.image_url
                    };
                }
            } else if (log.action === 'Exit' || log.action === 'EXIT') {
                if (openSessions[key]) {
                    openSessions[key].time_out = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    sessions.push(openSessions[key]);
                    delete openSessions[key];
                } else {
                    sessions.push({
                        id: log.id,
                        plate: plate,
                        gate: gate,
                        status: log.status,
                        date: dateStr,
                        time_in: "--",
                        time_out: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        created_at: log.created_at,
                        image_url: log.image_url
                    });
                }
            }
        });

        Object.values(openSessions).forEach(session => sessions.push(session));
        sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return sessions;
    }, [logs]);

    const filteredLogs = groupedSessions.filter(session => {
        const matchesSearch =
            session.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.gate.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDate = dateFilter ? session.date === new Date(dateFilter).toLocaleDateString() : true;

        const uiStatus = session.status === "GRANTED" ? "Authorized" : session.status === "DENIED" ? "Denied" : session.status;
        const matchesStatus = statusFilter === "All Status" || uiStatus === statusFilter;

        return matchesSearch && matchesDate && matchesStatus;
    });

    return (
        <DashboardLayout userType={userType}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">My Access Logs</h1>
                        <p className="text-slate-400">History of your vehicle entries and exits.</p>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
                        <Download className="h-4 w-4" /> Export CSV
                    </button>
                </div>

                <GlassCard className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by plate or gate..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-slate-200 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-slate-300 outline-none focus:bg-white/10"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 outline-none focus:bg-white/10"
                        >
                            <option>All Status</option>
                            <option>Authorized</option>
                            <option>Denied</option>
                        </select>
                    </div>
                </GlassCard>

                <GlassCard className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-white/5 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Vehicle</th>
                                    <th className="px-6 py-4 font-semibold">Location</th>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                    <th className="px-6 py-4 font-semibold">Time In</th>
                                    <th className="px-6 py-4 font-semibold">Time Out</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading your logs...</td>
                                    </tr>
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((session) => {
                                        const status = session.status;
                                        return (
                                            <tr key={session.id} className="group hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {session.image_url && (
                                                            <div className="h-10 w-16 overflow-hidden rounded-md bg-black border border-white/10 shrink-0 relative group/img">
                                                                <img src={`${API_BASE_URL}${session.image_url}`} alt="Plate" className="h-full w-full object-cover" />
                                                                <div
                                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                                                    onClick={() => setSelectedImage(`${API_BASE_URL}${session.image_url}`)}
                                                                >
                                                                    <Eye className="h-4 w-4 text-white" />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="font-mono text-white font-medium">{session.plate}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-slate-300">
                                                        <MapPin className="h-3 w-3" /> {session.gate}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-slate-300">
                                                        <Calendar className="h-3 w-3" /> {session.date}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-medium text-emerald-400">
                                                        {session.time_in}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-medium text-blue-400">
                                                        {session.time_out}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status === "GRANTED" ? "bg-emerald-500/10 text-emerald-400" :
                                                        status === "DENIED" ? "bg-red-500/10 text-red-400" :
                                                            "bg-yellow-500/10 text-yellow-400"
                                                        }`}>
                                                        {status === "GRANTED" ? "Allowed" : status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            No logs found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            </div>

            {/* Full Size Image Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                        >
                            <X className="h-8 w-8" />
                        </button>
                        <img
                            src={selectedImage}
                            alt="Full size capture"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                        />
                    </motion.div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default UserLogsPage;
