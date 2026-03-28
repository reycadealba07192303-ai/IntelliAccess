import React, { useEffect, useState } from "react";
import { GlassCard, GlassButton } from "../../components/ui/glass-components";
import { Search, Filter, CheckCircle, XCircle, Trash2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useNotification } from "../../context/NotificationContext";

type VehicleStatus = "Active" | "Blacklisted" | "Pending";

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  color: string;
  status: VehicleStatus;
  owner_id: string;
  owner?: {
    full_name: string;
    role: string;
  };
}

const VehiclesPage = () => {
  const { showNotification } = useNotification();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "All">("All");

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/vehicles');
      setVehicles(data as any);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      showNotification("Failed to load vehicles", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: VehicleStatus) => {
    try {
      await apiFetch(`/vehicles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      setVehicles(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
      showNotification(`Vehicle updated to ${newStatus}`, "success");
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Failed to update status", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;

    try {
      await apiFetch(`/vehicles/${id}`, {
        method: "DELETE",
      });

      setVehicles(prev => prev.filter(v => v.id !== id));
      showNotification("Vehicle deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      showNotification("Failed to delete vehicle", "error");
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesStatus = statusFilter === "All" ? true : v.status === statusFilter;
    if (!searchTerm) return matchesStatus;

    const term = searchTerm.toLowerCase();
    const ownerName = v.owner?.full_name || "Unknown";
    const plate = v.plate_number || "";
    const model = v.model || "";

    const matchesSearch =
      plate.toLowerCase().includes(term) ||
      ownerName.toLowerCase().includes(term) ||
      model.toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Registered Vehicles</h1>
          <p className="text-slate-400">Monitor and manage campus vehicle database.</p>
        </div>
      </div>

      <GlassCard className="p-0 overflow-hidden relative shadow-2xl rounded-2xl border border-white/10 bg-[#0f172a] flex flex-col">
        {/* Header/Filters */}
        <div className="p-6 bg-[#0f172a] z-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search plate number, model, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-slate-200 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Blacklisted">Blacklisted</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-280px)] min-h-[400px] px-6 pt-6 pb-6 after:content-[''] after:block after:h-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600/50">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-[#0f172a] z-10 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-white/5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
              <tr>
                <th className="px-6 py-4 font-medium">Vehicle</th>
                <th className="px-6 py-4 font-medium">Plate Number</th>
                <th className="px-6 py-4 font-medium">Owner</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">Loading vehicles...</td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">No vehicles found.</td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const statusClasses =
                    v.status === "Active"
                      ? "bg-transparent text-emerald-400 border-emerald-500/30"
                      : v.status === "Blacklisted"
                        ? "bg-transparent text-slate-400 border-slate-500/30"
                        : "bg-transparent text-amber-500 border-amber-500/30";

                  const dotColor =
                    v.status === "Active"
                      ? "bg-emerald-400"
                      : v.status === "Blacklisted"
                        ? "bg-slate-400"
                        : "bg-amber-500";

                  const displayStatus = v.status === "Blacklisted" ? "In Active" : v.status;

                  return (
                    <tr key={v.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-200">{v.model}</span>
                          <span className="text-xs text-slate-500">{v.color}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm tracking-widest bg-white/10 px-2 py-1 rounded inline-block">
                          {v.plate_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{v.owner?.full_name || "Unknown"}</span>
                          <span className="text-xs text-blue-400">{v.owner?.role || "GUEST"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border ${statusClasses}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`}></span>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {v.status === "Pending" && (
                            <button
                              onClick={() => handleUpdateStatus(v.id, "Active")}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {v.status !== "Active" && v.status !== "Pending" && (
                            <button
                              onClick={() => handleUpdateStatus(v.id, "Active")}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                              title="Reactivate"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {v.status !== "Blacklisted" && (
                            <button
                              onClick={() => handleUpdateStatus(v.id, "Blacklisted")}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Blacklist"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Vehicle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

export default VehiclesPage;
