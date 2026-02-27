import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import {
  Car,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users
} from "lucide-react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { GlassCard } from "../../components/ui/glass-components";

import { apiFetch } from "../../../lib/api";
import { useNotification } from "../../context/NotificationContext";

const AdminDashboard = ({ children }: { children?: React.ReactNode }) => {
  const { showNotification } = useNotification();

  const [statsData, setStatsData] = useState([
    { label: "Total Users", value: 0, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10", change: "Active" },
    { label: "Total Vehicles", value: 0, icon: Car, color: "text-blue-400", bg: "bg-blue-500/10", change: "Active" },
    { label: "Today's Entries", value: 0, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", change: "Today" },
    { label: "Unauthorized Attempts", value: 0, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", change: "Today" },
  ]);

  const [chartData, setChartData] = useState([
    { time: "06:00", count: 0 },
    { time: "08:00", count: 0 },
    { time: "10:00", count: 0 },
    { time: "12:00", count: 0 },
    { time: "14:00", count: 0 },
    { time: "16:00", count: 0 },
    { time: "18:00", count: 0 },
    { time: "20:00", count: 0 },
  ]);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const stats = await apiFetch("/stats");
        setStatsData([
          { label: "Total Users", value: stats.total_users, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10", change: "Active" },
          { label: "Total Vehicles", value: stats.total_vehicles, icon: Car, color: "text-blue-400", bg: "bg-blue-500/10", change: "Active" },
          { label: "Today's Entries", value: stats.todays_entries, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", change: "Today" },
          { label: "Unauthorized Attempts", value: stats.unauthorized_attempts, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", change: "Today" },
        ]);

        if (stats.chart_data) {
          setChartData(stats.chart_data);
        }

        const rawLogs = await apiFetch("/logs?limit=50");
        const openSessions: Record<string, any> = {};
        const sessions: any[] = [];

        const sortedLogs = [...rawLogs].sort((a: any, b: any) => new Date(a.created_at || a.timestamp).getTime() - new Date(b.created_at || b.timestamp).getTime());

        sortedLogs.forEach((log: any) => {
          const dateStr = new Date(log.created_at || log.timestamp).toLocaleDateString();
          const plate = log.plate_detected || "Unknown";
          const gate = log.gate?.replace('_', ' ') || "Unknown";
          const key = `${plate}-${dateStr}`;

          if (log.action === 'Entry' || log.action === 'ENTRY') {
            if (!openSessions[key]) {
              openSessions[key] = {
                id: log.id,
                plate: plate,
                owner: log.vehicle?.owner?.full_name || log.owner || "Unknown",
                gate: gate,
                status: log.status,
                time_in: new Date(log.created_at || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                time_out: "--",
                created_at: log.created_at || log.timestamp
              };
            }
          } else if (log.action === 'Exit' || log.action === 'EXIT') {
            if (openSessions[key]) {
              openSessions[key].time_out = new Date(log.created_at || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              sessions.push(openSessions[key]);
              delete openSessions[key];
            } else {
              sessions.push({
                id: log.id,
                plate: plate,
                owner: log.vehicle?.owner?.full_name || log.owner || "Unknown",
                gate: gate,
                status: log.status,
                time_in: "--",
                time_out: new Date(log.created_at || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                created_at: log.created_at || log.timestamp
              });
            }
          }
        });

        Object.values(openSessions).forEach(session => sessions.push(session));
        sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setRecentLogs(sessions.slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    if (!children) {
      fetchDashboardData();
    }
  }, [children]);

  if (children) {
    return <DashboardLayout>{children}</DashboardLayout>;
  }

  const handleDownloadReport = () => {
    showNotification("Generating report... Download will start shortly.", "info");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
            <p className="text-slate-400">Welcome back, Admin. Here's what's happening today.</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
              <Clock className="h-4 w-4" /> Real-time
            </button>
            <button
              onClick={handleDownloadReport}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Download Report
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard className="relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                    <h3 className="mt-2 text-3xl font-bold text-white">{stat.value}</h3>
                  </div>
                  <div className={`rounded-lg p-3 ${stat.bg} ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
                <span className="text-slate-500">{stat.change}</span>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <GlassCard className="h-full min-h-[400px]">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Vehicle Entry Volume</h3>
                <select className="bg-transparent text-sm text-slate-400 outline-none">
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </motion.div>

          {/* Recent Activity / Camera Feed Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard className="h-full flex flex-col">
              <h3 className="mb-4 text-lg font-semibold text-white">Live Gate Feed</h3>
              <Link to="/admin/camera" className="relative flex-1 rounded-xl bg-black overflow-hidden group block">
                <img
                  src="https://images.unsplash.com/photo-1662021163989-f0d185a5442d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxNb2Rlcm4lMjBDYXIlMjBQYXJraW5nJTIwR2F0ZSUyMFJGSUR8ZW58MXx8fHwxNzcwMTE1OTM0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Live Gate"
                  className="h-full w-full object-cover opacity-80 transition-transform group-hover:scale-105"
                />
                <div className="absolute top-2 left-2 flex items-center gap-2 rounded-full bg-black/50 px-2 py-1 backdrop-blur-md">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                  <span className="text-xs font-medium text-white">LIVE</span>
                </div>
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-sm text-white">Main Gate Cam 1</p>
                  <p className="text-xs text-slate-400">Detecting Plate...</p>
                </div>
              </Link>
            </GlassCard>
          </motion.div>
        </div>

        {/* Recent Logs Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GlassCard>
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recent Access Logs</h3>
              <Link to="/admin/logs" className="text-sm text-blue-400 hover:text-blue-300">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Plate Number</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Gate</th>
                    <th className="px-4 py-3 font-semibold text-center">Time In / Out</th>
                    <th className="px-4 py-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No recent activity recorded today.
                      </td>
                    </tr>
                  ) : (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="group hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{log.plate}</td>
                        <td className="px-4 py-3">{log.owner}</td>
                        <td className="px-4 py-3 text-slate-300">{log.gate}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-emerald-400 font-medium">{log.time_in}</span>
                            <span className="text-slate-500">-</span>
                            <span className="text-blue-400 font-medium">{log.time_out}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${log.status === "GRANTED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : log.status === "DENIED"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-yellow-500/10 text-yellow-400"
                            }`}>
                            {log.status === "GRANTED" && <CheckCircle className="mr-1 h-3 w-3" />}
                            {log.status === "DENIED" && <AlertTriangle className="mr-1 h-3 w-3" />}
                            {log.status === "GRANTED" ? "Allowed" : log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
