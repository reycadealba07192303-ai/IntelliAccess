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

      <GlassCard className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
      </GlassCard>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading vehicles...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No vehicles found.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((v) => {
            const statusClasses =
              v.status === "Active"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : v.status === "Blacklisted"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

            return (
              <GlassCard key={v.id} className="group relative overflow-hidden flex flex-col justify-between h-full" hoverEffect>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${statusClasses}`}>
                      {v.status}
                    </span>
                    <button
                      onClick={() => handleDelete(v.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="Delete Vehicle"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="text-2xl font-mono font-bold text-white tracking-wider mb-1">{v.plate_number}</h3>
                  <p className="text-sm text-slate-400 mb-4">{v.model} • {v.color}</p>

                  <div className="border-t border-white/10 pt-4 mb-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Owner</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-200 truncate">{v.owner?.full_name || "Unknown"}</span>
                      <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                        {v.owner?.role || "GUEST"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  {v.status === "Pending" && (
                    <button
                      onClick={() => handleUpdateStatus(v.id, "Active")}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {v.status !== "Active" && v.status !== "Pending" && (
                    <button
                      onClick={() => handleUpdateStatus(v.id, "Active")}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Reactivate
                    </button>
                  )}
                  {v.status !== "Blacklisted" && (
                    <button
                      onClick={() => handleUpdateStatus(v.id, "Blacklisted")}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <AlertCircle className="h-3.5 w-3.5" /> Blacklist
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};


export default VehiclesPage;
