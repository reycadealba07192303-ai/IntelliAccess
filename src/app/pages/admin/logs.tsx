import React, { useState, useEffect } from "react";
import { GlassCard } from "../../components/ui/glass-components";
import { Search, Calendar, MapPin, Download, Eye } from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiFetch, API_BASE_URL } from "@/lib/api";

interface AccessLog {
  id: number;
  created_at: string;
  gate: string;
  action: string;
  status: string;
  plate_detected: string;
  image_url?: string;
  vehicle?: {
    model: string;
    owner?: {
      full_name: string;
      role: string;
    }
  };
}

const LogsPage = () => {
  const { showNotification } = useNotification();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [gateFilter, setGateFilter] = useState("All Gates");
  const [roleFilter, setRoleFilter] = useState("All Roles");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/logs');
      setLogs(data as any);
    } catch (error) {
      console.error("Error fetching logs:", error);
      showNotification("Failed to load access logs", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
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
            vehicle: log.vehicle,
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
            vehicle: log.vehicle,
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
    const plate = session.plate;
    const ownerName = session.vehicle?.owner?.full_name || "Guest/Unknown";
    const role = session.vehicle?.owner?.role || "Visitor";
    const gate = session.gate;

    const matchesSearch =
      plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.id.toString().includes(searchTerm);

    const matchDate = dateFilter ? session.date === new Date(dateFilter).toLocaleDateString() : true;

    // Gate Mapping
    // DB: MAIN_GATE, BACK_GATE
    // UI: Main Gate, Back Gate
    const uiGate = gate.toLowerCase().replace('_', ' ');
    const filterGateLower = gateFilter.toLowerCase();
    const matchesGate = gateFilter === "All Gates" || uiGate.includes(filterGateLower.replace(' gate', ''));

    // Role Mapping
    const matchesRole = roleFilter === "All Roles" || role === roleFilter.toUpperCase() || (roleFilter === "Visitor" && !session.vehicle);

    return matchesSearch && matchDate && matchesGate && matchesRole;
  });

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      showNotification("No logs available to export.", "warning");
      return;
    }

    showNotification("Exporting logs to CSV...", "info");

    // CSV Headers
    const headers = ["Vehicle Plate", "User Type", "Location (Gate)", "Date", "Time In", "Time Out", "Status"];

    // CSV Rows
    const csvRows = filteredLogs.map(session => {
      const role = session.vehicle?.owner?.role || "GUEST";
      const displayRole = role.charAt(0) + role.slice(1).toLowerCase();

      // Escape commas and quotes to be safe
      const escapeCsv = (str: string) => `"${String(str).replace(/"/g, '""')}"`;

      return [
        escapeCsv(session.plate),
        escapeCsv(displayRole),
        escapeCsv(session.gate),
        escapeCsv(session.date),
        escapeCsv(session.time_in),
        escapeCsv(session.time_out),
        escapeCsv(session.status)
      ].join(",");
    });

    // Combine Headers and Rows
    const csvContent = [headers.join(","), ...csvRows].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `IntelliAccess_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Access Logs</h1>
          <p className="text-slate-400">Detailed history of all vehicle entries and exits.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <Search className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <GlassCard className="p-0 overflow-hidden relative shadow-2xl rounded-2xl border border-white/10 bg-[#0f172a] flex flex-col">
        {/* Header/Filters */}
        <div className="px-6 pt-6 pb-2 bg-[#0f172a] z-10 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs by plate or owner..."
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
              value={gateFilter}
              onChange={(e) => setGateFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 outline-none focus:bg-white/10"
            >
              <option>All Gates</option>
              <option>Main Gate</option>
              <option>Back Gate</option>
              <option>Service Gate</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 outline-none focus:bg-white/10"
            >
              <option>All Roles</option>
              <option>Student</option>
              <option>Professor</option>
              <option>Utility</option>
              <option>Visitor</option>
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] px-4 pt-0 pb-4 after:content-[''] after:block after:h-4 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full text-left text-sm text-slate-400 border-collapse">
            <thead className="sticky top-0 bg-[#0f172a]/80 backdrop-blur-md z-10 text-xs uppercase tracking-wider text-slate-400 font-bold border-b border-white/10 shadow-[0_1px_10px_0_rgba(0,0,0,0.2)]">
              <tr>
                <th className="px-4 py-2 font-medium min-w-[200px]">Vehicle</th>
                <th className="px-4 py-2 font-medium">User Type</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Time In</th>
                <th className="px-4 py-2 font-medium">Time Out</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading logs...</td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((session) => {
                  const ownerName = session.vehicle?.owner?.full_name || "Guest / Unknown";
                  const role = session.vehicle?.owner?.role || "GUEST";
                  const displayRole = role.charAt(0) + role.slice(1).toLowerCase();
                  const status = session.status || "Unknown";

                  return (
                    <tr key={session.id} className="group hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2 min-w-[200px]">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {session.image_url && (
                            <div className="h-9 w-14 overflow-hidden rounded-md bg-black border border-white/10 shrink-0 relative">
                              <img src={`${API_BASE_URL}${session.image_url}`} alt="Plate" className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                <Eye className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <div className="font-mono text-white font-medium text-sm truncate leading-tight">{session.plate}</div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5 leading-tight">{ownerName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${role === "FACULTY" ? "bg-blue-500/10 text-blue-400" :
                          role === "STUDENT" ? "bg-emerald-500/10 text-emerald-400" :
                            role === "STAFF" ? "bg-orange-500/10 text-orange-400" :
                              "bg-slate-500/10 text-slate-400"
                          }`}>
                          {displayRole}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 text-slate-300 whitespace-nowrap text-xs">
                          <MapPin className="h-3 w-3 shrink-0" /> {session.gate}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 text-slate-300 whitespace-nowrap text-xs">
                          <Calendar className="h-3 w-3 shrink-0" /> {session.date}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium text-emerald-400 whitespace-nowrap text-xs">
                          {session.time_in}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium text-blue-400 whitespace-nowrap text-xs">
                          {session.time_out}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] border bg-transparent whitespace-nowrap ${
                          status === "GRANTED" ? "text-emerald-400 border-emerald-500/30" :
                          status === "DENIED" ? "text-red-400 border-red-500/30" :
                          "text-amber-500 border-amber-500/30"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            status === "GRANTED" ? "bg-emerald-400" :
                            status === "DENIED" ? "bg-red-400" :
                            "bg-amber-500"
                          }`}></span>
                          {status === "GRANTED" ? "Allowed" : status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No logs found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

export default LogsPage;
