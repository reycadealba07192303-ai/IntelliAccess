import React, { useEffect, useState } from "react";
import { GlassCard, GlassButton } from "../../components/ui/glass-components";
import { Search, Filter, CheckCircle, XCircle, Trash2, AlertCircle, Plus, Tag, Disc, Car, Bike, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useNotification } from "../../context/NotificationContext";

type VehicleStatus = "Active" | "Blacklisted" | "Pending";

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  color: string;
  body_type?: string;
  rfid_tag?: string;
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
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "All">("All");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [formData, setFormData] = useState({
    plate_number: "",
    model: "",
    color: "",
    body_type: "Sedan",
    rfid_tag: "",
    owner_id: ""
  });

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

  const fetchUsers = async () => {
    try {
      const data = await apiFetch('/auth/users');
      setUsers(data as any);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchUsers();
  }, []);

  const handleOpenModal = (vehicle: Vehicle | null = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plate_number: vehicle.plate_number,
        model: vehicle.model,
        color: vehicle.color,
        body_type: vehicle.body_type || "Sedan",
        rfid_tag: vehicle.rfid_tag || "",
        owner_id: vehicle.owner_id
      });
      const owner = users.find(u => u.id === vehicle.owner_id);
      setOwnerSearch(owner ? (owner.name || owner.email) : "");
    } else {
      setEditingVehicle(null);
      setFormData({
        plate_number: "",
        model: "",
        color: "",
        body_type: "Sedan",
        rfid_tag: "",
        owner_id: ""
      });
      setOwnerSearch("");
    }
    setShowOwnerDropdown(false);
    setIsModalOpen(true);
  };

  const handleScanRFID = async () => {
    setIsScanning(true);
    showNotification("Waiting for RFID tag... Please tap tag on reader.", "info");
    try {
      const result: any = await apiFetch("/rfid/read", { method: "POST" });
      if (result.status === "success") {
        setFormData(prev => ({ ...prev, rfid_tag: result.tag_id }));
        showNotification("RFID Tag Scanned Successfully!", "success");
      } else {
        showNotification(result.message || "No tag detected", "warning");
      }
    } catch (error) {
      showNotification("Failed to connect to RFID reader", "error");
    } finally {
      setIsScanning(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await apiFetch(`/vehicles/${editingVehicle.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        showNotification("Vehicle updated successfully", "success");
      } else {
        await apiFetch("/vehicles", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        showNotification("Vehicle registered successfully", "success");
      }
      setIsModalOpen(false);
      fetchVehicles();
    } catch (error) {
      showNotification("Failed to save vehicle", "error");
    }
  };

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
        <GlassButton 
          onClick={() => handleOpenModal()} 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white border-none"
        >
          <Plus className="h-4 w-4" />
          Add Vehicle
        </GlassButton>
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
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-280px)] min-h-[400px] px-6 pb-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-600/50">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-[#0f172a] z-10 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-white/5 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
              <tr>
                <th className="px-6 py-4 font-medium">Vehicle</th>
                <th className="px-6 py-4 font-medium">Plate Number / RFID</th>
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
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono text-sm tracking-widest bg-white/10 px-2 py-1 rounded inline-block w-fit">
                            {v.plate_number}
                          </span>
                          {v.rfid_tag && (
                            <span className="text-[10px] text-blue-400 flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {v.rfid_tag}
                            </span>
                          )}
                        </div>
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
                          <button
                            onClick={() => handleOpenModal(v)}
                            className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="Edit Vehicle"
                          >
                            <Filter className="h-4 w-4" />
                          </button>
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-lg p-6 border-white/10 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingVehicle ? "Edit Vehicle" : "Register New Vehicle"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Plate Number</label>
                  <input
                    type="text"
                    required
                    value={formData.plate_number}
                    onChange={(e) => setFormData({...formData, plate_number: e.target.value})}
                    placeholder="ABC 1234"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm text-white focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vehicle Model</label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    placeholder="Toyota Vios"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm text-white focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Color</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    placeholder="Pearl White"
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm text-white focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Body Type</label>
                  <select
                    value={formData.body_type}
                    onChange={(e) => setFormData({...formData, body_type: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-[#1e293b] py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Tricycle">Tricycle</option>
                    <option value="Truck">Truck</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Owner / User Account</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search user..."
                    value={ownerSearch}
                    onChange={(e) => {
                      setOwnerSearch(e.target.value);
                      setFormData({...formData, owner_id: ""});
                      setShowOwnerDropdown(true);
                    }}
                    onFocus={() => setShowOwnerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowOwnerDropdown(false), 150)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {showOwnerDropdown && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-[#1e293b] shadow-xl max-h-48 overflow-y-auto">
                      <div
                        className="px-3 py-2 text-sm text-slate-400 hover:bg-white/10 cursor-pointer"
                        onMouseDown={() => { setOwnerSearch(""); setFormData({...formData, owner_id: ""}); setShowOwnerDropdown(false); }}
                      >
                        -- No specific owner --
                      </div>
                      {users
                        .filter(u => {
                          const q = ownerSearch.toLowerCase();
                          return !q || (u.name||u.email||"").toLowerCase().includes(q) || (u.role||"").toLowerCase().includes(q);
                        })
                        .map(u => (
                          <div
                            key={u.id}
                            onMouseDown={() => {
                              setOwnerSearch(u.name || u.email);
                              setFormData({...formData, owner_id: u.id});
                              setShowOwnerDropdown(false);
                            }}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-white/10 flex items-center justify-between ${
                              formData.owner_id === u.id ? 'text-blue-400 bg-blue-500/10' : 'text-white'
                            }`}
                          >
                            <span>{u.name || u.email}</span>
                            <span className="text-xs text-slate-500">{u.role}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
                {formData.owner_id && (
                  <p className="text-[10px] text-emerald-400">✓ Owner selected: {ownerSearch}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">RFID UID Tag</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={formData.rfid_tag}
                      onChange={(e) => setFormData({...formData, rfid_tag: e.target.value})}
                      placeholder="Scan or type Tag ID..."
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-blue-300 font-mono focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <GlassButton 
                    type="button"
                    onClick={handleScanRFID}
                    disabled={isScanning}
                    className={`flex items-center gap-2 px-4 ${isScanning ? 'bg-blue-500/50' : 'bg-blue-500 hover:bg-blue-400'} text-white border-none`}
                  >
                    {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Disc className="h-4 w-4" />}
                    {isScanning ? "Scanning..." : "Scan"}
                  </GlassButton>

                </div>
                <p className="text-[10px] text-slate-500 italic">Tap the RFID sticker on the reader to auto-fill this field.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <GlassButton 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                >
                  Cancel
                </GlassButton>
                <GlassButton 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-none"
                >
                  {editingVehicle ? "Save Changes" : "Register Vehicle"}
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default VehiclesPage;
