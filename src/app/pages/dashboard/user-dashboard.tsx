import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, Car, MapPin, Clock, Trash2, Edit2, Save, AlertTriangle } from "lucide-react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { GlassCard, GlassButton } from "../../components/ui/glass-components";
import { useNotification } from "../../context/NotificationContext";

import { apiFetch } from "../../../lib/api";

interface UserDashboardProps {
  userType?: "user" | "student" | "faculty" | "utility";
}

const UserDashboard: React.FC<UserDashboardProps> = ({ userType = "user" }) => {
  const { showNotification } = useNotification();
  const [myVehicles, setMyVehicles] = useState<any[]>([]);

  const fetchVehicles = async () => {
    try {
      const data = await apiFetch("/vehicles/");

      // format backend output for frontend UI ("plate_number" to "plate")
      const formatted = data.map((v: any) => ({
        ...v,
        plate: v.plate_number,
      }));
      setMyVehicles(formatted);
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
    }
  };

  const [myLogs, setMyLogs] = useState<any[]>([]);

  const fetchLogs = async () => {
    try {
      const data = await apiFetch("/notifications/me?limit=5");
      const formatted = data.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        date: new Date(n.created_at).toLocaleDateString(),
        time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
      setMyLogs(formatted);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchLogs();
  }, []);
  // State for Vehicle Registration
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    plate: "",
    model: ""
  });

  // State for Vehicle Details/CRUD
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // State for Delete Confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Handlers


  const handleRegister = async () => {
    try {
      await apiFetch("/vehicles/", {
        method: "POST",
        body: JSON.stringify({
          plate_number: newVehicle.plate,
          model: newVehicle.model,
        }),
      });
      setIsRegisterModalOpen(false);
      setNewVehicle({ plate: "", model: "" });
      showNotification("Vehicle registered successfully", "success");
      fetchVehicles();
      fetchLogs();
    } catch (error) {
      console.error(error);
      showNotification("Failed to register vehicle", "error");
    }
  };

  const handleVehicleClick = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setIsDetailsModalOpen(true);
    setIsEditing(false);
  };

  const handleUpdate = async () => {
    try {
      await apiFetch(`/vehicles/${selectedVehicle.id}`, {
        method: "PUT",
        body: JSON.stringify({
          plate_number: selectedVehicle.plate,
          model: selectedVehicle.model,
          color: selectedVehicle.color
        }),
      });
      setIsEditing(false);
      fetchVehicles();
      fetchLogs();
      showNotification("Vehicle details updated", "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to update vehicle", "error");
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await apiFetch(`/vehicles/${selectedVehicle.id}`, {
        method: "DELETE"
      });
      setIsDeleteModalOpen(false);
      setIsDetailsModalOpen(false);
      fetchVehicles();
      fetchLogs();
      showNotification("Vehicle deleted successfully", "success");
    } catch (error) {
      console.error(error);
      showNotification("Failed to delete vehicle", "error");
    }
  };

  return (
    <DashboardLayout userType={userType}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Vehicles</h1>
            <p className="text-slate-400">Manage your registered vehicles and view access history.</p>
          </div>
          <GlassButton className="hidden sm:flex" onClick={() => setIsRegisterModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Register Vehicle
          </GlassButton>
        </div>

        {/* Vehicles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {myVehicles.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500">
              No vehicles registered yet. Click "Add New Vehicle" to get started.
            </div>
          ) : (
            myVehicles.map((vehicle, index) => (
              <motion.div
                key={vehicle.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleVehicleClick(vehicle)}
                className="cursor-pointer"
              >
                <GlassCard hoverEffect className="group relative h-full">
                  <div className="absolute top-4 right-4">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${vehicle.status === "Active" ? "bg-blue-500/10 text-blue-400" : "bg-blue-500/10 text-blue-400"
                      }`}>
                      {vehicle.status}
                    </span>
                  </div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <Car className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{vehicle.plate}</h3>
                  <p className="text-slate-400">{vehicle.model}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <span className="h-3 w-3 rounded-full bg-slate-600" style={{ backgroundColor: vehicle.color === "Silver" ? "#C0C0C0" : "#333" }}></span>
                    {vehicle.color}
                  </div>
                </GlassCard>
              </motion.div>
            ))
          )}

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex h-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-blue-500/50 hover:bg-white/10 hover:text-blue-400"
          >
            <Plus className="mb-2 h-8 w-8" />
            <span className="font-medium">Add New Vehicle</span>
          </motion.div>
        </div>

        {/* Recent Logs Section */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-white">Recent Activity</h2>
          <GlassCard>
            <div className="space-y-4">
              {myLogs.length === 0 ? (
                <div className="py-4 text-center text-slate-500 text-sm">
                  No recent activity.
                </div>
              ) : (
                myLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{log.title}</p>
                        <p className="text-sm text-slate-400 line-clamp-1">{log.message}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-blue-400">
                        {log.date}
                      </p>
                      <div className="flex justify-end items-center gap-1 text-sm text-slate-500 mt-1">
                        <Clock className="h-3 w-3" /> {log.time}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Register Vehicle Modal */}
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <GlassCard className="relative">
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6">Register New Vehicle</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Plate Number</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="ABC 1234"
                      value={newVehicle.plate}
                      onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Vehicle Model</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Toyota Vios 2023"
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    />
                  </div>
                  <GlassButton className="w-full mt-2" onClick={handleRegister}>
                    Submit Registration
                  </GlassButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {/* Vehicle Details Modal */}
        {isDetailsModalOpen && selectedVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <GlassCard className="relative">
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>

                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">Vehicle Details</h2>
                  <div className="flex gap-2 mr-8">
                    {!isEditing && (
                      <>
                        <button onClick={() => setIsEditing(true)} className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={handleDeleteClick} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Status Badge */}
                  <div className="flex justify-center mb-6">
                    <div className={`rounded-full px-3 py-1 text-sm font-medium ${selectedVehicle.status === "Active" ? "bg-blue-500/10 text-blue-400" : "bg-blue-500/10 text-blue-400"
                      }`}>
                      {selectedVehicle.status}
                    </div>
                  </div>

                  {/* Vehicle Image (Placeholder if none) */}
                  <div className="flex justify-center mb-6">
                    <div className="h-32 w-full flex items-center justify-center bg-white/5 rounded-lg border border-white/10">
                      <Car className="h-16 w-16 text-slate-500" />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Plate Number</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={selectedVehicle.plate}
                          onChange={(e) => setSelectedVehicle({ ...selectedVehicle, plate: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-lg font-bold text-white">{selectedVehicle.plate}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Model</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={selectedVehicle.model}
                          onChange={(e) => setSelectedVehicle({ ...selectedVehicle, model: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-lg font-bold text-white">{selectedVehicle.model}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Color</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={selectedVehicle.color}
                          onChange={(e) => setSelectedVehicle({ ...selectedVehicle, color: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-slate-600" style={{ backgroundColor: selectedVehicle.color === "Silver" ? "#C0C0C0" : "#333" }}></span>
                          <span className="text-white">{selectedVehicle.color}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <GlassButton className="w-full mt-4 flex items-center justify-center gap-2" onClick={handleUpdate}>
                      <Save className="h-4 w-4" /> Save Changes
                    </GlassButton>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm"
            >
              <GlassCard className="border-red-500/20">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Delete Vehicle?</h3>
                  <p className="text-slate-400 mb-6">
                    Are you sure you want to delete <span className="text-white font-semibold">{selectedVehicle?.plate}</span>? This action cannot be undone.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout >
  );
};

export default UserDashboard;
