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

                <GlassCard className="p-0 overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[24px] border border-white/5 bg-[#0a0f1e]/80 backdrop-blur-2xl flex flex-col min-h-[500px]">
                    {/* Header/Filters (Floating Island Design) */}
                    <div className="mx-6 mt-6 mb-6 p-4 bg-white/[0.02] rounded-2xl z-10 flex flex-col gap-4 lg:flex-row lg:items-center border border-white/5 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by plate or gate..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-slate-200 transition-all focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-slate-300 outline-none transition-all focus:bg-white/10 focus:ring-1 focus:ring-blue-500/40"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 outline-none transition-all focus:bg-white/10 focus:ring-1 focus:ring-blue-500/40 appearance-none min-w-[120px]"
                            >
                                <option className="bg-slate-900">All Status</option>
                                <option className="bg-slate-900">Authorized</option>
                                <option className="bg-slate-900">Denied</option>
                            </select>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] px-6 pt-2 pb-6 custom-scrollbar scroll-smooth">
                        <style>{`
                            .custom-scrollbar::-webkit-scrollbar {
                              width: 6px;
                              height: 6px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                              background: transparent;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                              background: rgba(255, 255, 255, 0.1);
                              border-radius: 10px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                              background: rgba(255, 255, 255, 0.2);
                            }
                        `}</style>
                        <table className="w-full text-left text-sm text-slate-400 border-collapse">
                            <thead className="sticky top-0 bg-[#0a0f1e]/80 backdrop-blur-xl z-20 text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-white/5 shadow-sm">
                                <tr>
                                    <th className="px-4 py-4 font-bold min-w-[220px]">Vehicle Details</th>
                                    <th className="px-4 py-4 font-bold">Gate Point</th>
                                    <th className="px-4 py-4 font-bold">Date</th>
                                    <th className="px-4 py-4 font-bold">Time In</th>
                                    <th className="px-4 py-4 font-bold">Time Out</th>
                                    <th className="px-4 py-4 font-bold">Access Status</th>
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
                                            <tr key={session.id} className="group hover:bg-white/[0.03] transition-colors">
                                                <td className="px-4 py-4 min-w-[220px]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-16 overflow-hidden rounded-xl bg-slate-900 border border-white/10 shrink-0 relative group/img shadow-inner flex items-center justify-center">
                                                            {session.image_url ? (
                                                                <>
                                                                    <img 
                                                                        src={`${API_BASE_URL}${session.image_url}`} 
                                                                        alt="Plate" 
                                                                        className="h-full w-full object-cover transition-transform group-hover/img:scale-110" 
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                                        }}
                                                                    />
                                                                    <div
                                                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-[1px]"
                                                                        onClick={() => setSelectedImage(`${API_BASE_URL}${session.image_url}`)}
                                                                    >
                                                                        <Eye className="h-4 w-4 text-white" />
                                                                    </div>
                                                                    {/* Native Fallback if image fails to load */}
                                                                    <div className="hidden absolute inset-0 flex-col items-center justify-center opacity-40 bg-slate-900 pointer-events-none">
                                                                        <Search className="h-4 w-4 text-slate-400 mb-0.5" />
                                                                        <span className="text-[8px] uppercase font-bold tracking-tighter text-slate-500">NO IMG</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                                    <Search className="h-4 w-4 text-slate-400 mb-0.5" />
                                                                    <span className="text-[8px] uppercase font-bold tracking-tighter text-slate-500">NO IMG</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex flex-col">
                                                            <div className="font-bold text-white tracking-tight text-sm flex items-center gap-1.5">
                                                                {session.plate}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2 text-slate-300">
                                                        <MapPin className="h-3 w-3" /> {session.gate}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2 text-slate-300">
                                                        <Calendar className="h-3 w-3" /> {session.date}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="inline-flex items-center justify-center bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider">
                                                        {session.time_in}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="inline-flex items-center justify-center bg-blue-500/5 text-blue-400 border border-blue-500/10 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider">
                                                        {session.time_out}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase border border-white/10 shadow-sm ${
                                                        status === "GRANTED" ? "text-emerald-400 bg-emerald-500/10 shadow-emerald-500/5" :
                                                        status === "DENIED" ? "text-rose-400 bg-rose-500/10 shadow-rose-500/5" :
                                                        "text-amber-500 bg-amber-500/10 shadow-amber-500/5"
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                                                            status === "GRANTED" ? "bg-emerald-400" :
                                                            status === "DENIED" ? "bg-rose-400" :
                                                            "bg-amber-500"
                                                        }`}></span>
                                                        {status === "GRANTED" ? "AUTHORIZED" : status}
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
