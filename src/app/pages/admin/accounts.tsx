import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  GraduationCap,
  Briefcase,
  Wrench,
  X,
  Eye,
  ChevronDown,
  Download,
  Car,
} from "lucide-react";
import { apiFetch, API_BASE_URL } from "@/lib/api";
import { GlassCard, GlassButton, GlassInput } from "../../components/ui/glass-components";
import { useNotification } from "../../context/NotificationContext";

// Types
type UserRole = "Student" | "Professor" | "Utility" | "Admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicles?: any[];
  status: "Active" | "Inactive" | "Pending" | "Blacklisted";
  lastActive: string;
  vehicleStatus?: "Active" | "Blacklisted" | "Pending";
  vehiclePlateImage?: string;
}

const AccountsPage = () => {
  const { showNotification } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | UserRole>("All");
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "history" | "images">("info");
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [vehicleImages, setVehicleImages] = useState<any[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // Fetch Users from Supabase
  const fetchUsers = async () => {
    try {
      // 1. Fetch Profiles
      const profiles = await apiFetch('/auth/users');

      // 2. Fetch Vehicles
      const vehicles = await apiFetch('/vehicles');

      // 3. Merge Data
      const formattedUsers: User[] = (profiles || []).map((profile: any) => {
        // Find vehicles for this user
        const userVehicles = vehicles?.filter((v: any) => v.owner_id === profile.id) || [];
        const vehicleCount = userVehicles.length;

        // Map Role
        let role: UserRole = "Student";
        const dbRole = profile.role?.toUpperCase();
        if (dbRole === 'ADMIN') role = "Admin";
        else if (dbRole === 'FACULTY') role = "Professor";
        else if (dbRole === 'STAFF') role = "Utility";
        else role = "Student";

        return {
          id: profile.id,
          name: profile.name || "Unknown User",
          email: profile.email || "",
          role: role,
          vehicles: userVehicles,
          vehiclePlate: vehicleCount > 0 ? `${vehicleCount} Registered` : undefined,
          vehicleModel: vehicleCount === 1 ? `1 Vehicle` : vehicleCount > 1 ? `${vehicleCount} Vehicles` : undefined,
          status: "Active", // Default for now
          lastActive: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown",
          vehicleStatus: vehicleCount > 0 ? "Active" : undefined,
          vehiclePlateImage: undefined // Placeholder
        };
      });

      setUsers(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Failed to load users", "error");
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  React.useEffect(() => {
    if (activeTab === "history" && editingUser?.id) {
      const fetchActivity = async () => {
        setIsLoadingLogs(true);
        try {
          const notifs = await apiFetch(`/notifications?target_user_id=${editingUser.id}`);
          const gLogs = await apiFetch(`/logs?owner_id=${editingUser.id}`);

          const combined = [];
          if (Array.isArray(notifs)) {
            combined.push(...notifs.map((n: any) => ({
              action: n.title,
              time: n.created_at,
              details: n.message
            })));
          }
          if (Array.isArray(gLogs)) {
            combined.push(...gLogs.map((l: any) => ({
              action: `Gate ${l.status || 'Access'}`,
              time: l.created_at || l.timestamp,
              details: `${l.action || 'Entry'} via ${l.gate?.replace('_', ' ')} (${l.plate_detected})`
            })));
          }

          combined.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

          setActivityLogs(combined.map(log => ({
            action: log.action,
            time: new Date(log.time + (log.time.endsWith('Z') ? '' : 'Z')).toLocaleString(),
            details: log.details
          })));
        } catch (error) {
          console.error("Error fetching activity:", error);
        } finally {
          setIsLoadingLogs(false);
        }
      };
      fetchActivity();
    }
  }, [activeTab, editingUser]);

  // Fetch Vehicle Images
  React.useEffect(() => {
    if (activeTab === "images" && editingUser?.id) {
      const fetchImages = async () => {
        setIsLoadingImages(true);
        try {
          const gLogs = await apiFetch(`/logs?owner_id=${editingUser.id}`);
          if (Array.isArray(gLogs)) {
            const logsWithImages = gLogs.filter(l => l.image_url);
            logsWithImages.sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());

            setVehicleImages(logsWithImages.map(log => ({
              url: `${API_BASE_URL}${log.image_url}`,
              date: new Date(log.created_at || log.timestamp).toLocaleString(),
              plate: log.plate_detected
            })));
          }
        } catch (error) {
          console.error("Error fetching images:", error);
        } finally {
          setIsLoadingImages(false);
        }
      };
      fetchImages();
    }
  }, [activeTab, editingUser]);

  // Download function
  const handleDownloadHistory = () => {
    const historyData = activityLogs.length > 0 ? activityLogs : [];

    // Create HTML content for the Word doc
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>User History</title></head>
      <body>
        <h1>Activity History for ${editingUser?.name || "User"}</h1>
        <table border="1" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="padding: 8px;">Action</th>
              <th style="padding: 8px;">Date & Time</th>
              <th style="padding: 8px;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${historyData.map(log => `
              <tr>
                <td style="padding: 8px;">${log.action}</td>
                <td style="padding: 8px;">${log.time}</td>
                <td style="padding: 8px;">${log.details}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `history-${editingUser?.name || "user"}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification("History downloaded successfully", "success");
  };

  const handleDownloadAllData = () => {
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>All User Accounts</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>All User Accounts</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Vehicle Plate</th>
              <th>Vehicle Model</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.status}</td>
                <td>${user.vehiclePlate || '-'}</td>
                <td>${user.vehicleModel || '-'}</td>
                <td>${user.lastActive}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-users-${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification("All user data downloaded successfully", "success");
  };



  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    role: "Student",
    vehiclePlate: "",
    vehicleModel: "",
    status: "Active",
  });

  const handleOpenModal = (user?: User, mode: "add" | "edit" | "view" = "add") => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        role: "Student",
        vehiclePlate: "",
        vehicleModel: "",
        status: "Active",
      });
    }

    setIsViewMode(mode === "view");
    setActiveTab("info");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsViewMode(false);
    setEditingUser(null);
  };



  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this user? This will also delete their profile and vehicles.")) {
      try {
        // Delete from Auth Users (Requires Admin API - skipped for now, just deleting profile)
        // In a real app, you'd call a Supabase Edge Function to delete the Auth User.
        // For now, we delete the profile which cascades.
        await apiFetch(`/auth/users/${id}`, { method: 'DELETE' });

        setUsers((prev) => prev.filter((u) => u.id !== id));
        showNotification("User deleted successfully", "success");
      } catch (error) {
        console.error("Error deleting user:", error);
        showNotification("Failed to delete user", "error");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;

    try {
      if (editingUser) {
        // Update Profile
        await apiFetch(`/auth/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: formData.name })
        });

        // Update local state
        setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, ...formData } as User : u));
        showNotification("User updated successfully", "success");
      } else {
        // Create User - This is tricky client-side without Admin API 
        // usually enables 'Sign Up' instead. 
        // For now, let's show a notification that this requires the user to Sign Up manually
        // OR we can call a supabase function if we had one.
        showNotification("To add a new user, please ask them to Sign Up via the registration page.", "info");
        // We won't actually insert here because we can't create Auth users from client-side easily without Service Role
      }
      setIsModalOpen(false);
      fetchUsers(); // Refresh to be sure
    } catch (error) {
      console.error("Error saving user:", error);
      showNotification("Failed to save changes", "error");
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "Admin": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Professor": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Student": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "Utility": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "Admin": return <Shield className="h-4 w-4" />;
      case "Professor": return <Briefcase className="h-4 w-4" />;
      case "Student": return <GraduationCap className="h-4 w-4" />;
      case "Utility": return <Wrench className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.vehiclePlate?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      roleFilter === "All" ? true : user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // sort so it's nicely grouped like in the reference: by role then by name
  const roleOrder: Record<UserRole, number> = {
    Student: 1,
    Professor: 2,
    Utility: 3,
    Admin: 4,
  };

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const roleDiff = roleOrder[a.role] - roleOrder[b.role];
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Accounts</h1>
          <p className="text-slate-400">Manage students, faculty, and staff access.</p>
        </div>
        <div className="flex gap-3">
          <GlassButton onClick={handleDownloadAllData}>
            <Download className="mr-2 h-4 w-4" /> Download All
          </GlassButton>
          <GlassButton onClick={() => handleOpenModal(undefined, "add")}>
            <Plus className="mr-2 h-4 w-4" /> Add User
          </GlassButton>
        </div>
      </div>

      {/* Tabs-style role filter + search */}
      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex gap-1.5 rounded-full bg-slate-900/80 p-1.5">
            {["All", "Student", "Professor", "Utility", "Admin"].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role as any)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${roleFilter === role
                  ? "bg-white text-slate-900"
                  : "text-slate-300 hover:bg-white/5"
                  }`}
              >
                {role === "All" ? "All Accounts" : role}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, or plate number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-slate-200 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Single table, sorted/grouped like the example */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
          <table className="w-full text-left text-base text-slate-300">
            <thead className="bg-white/5 text-sm uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
                <th className="px-4 py-3 font-semibold">Last Active</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {sortedUsers.map((user) => (
                <tr key={user.id} className="group hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">
                        {user.name.charAt(0)}
                      </div>
                      <span className="font-medium text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[15px] text-slate-200">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${getRoleBadge(
                        user.role
                      )}`}
                    >
                      {getRoleIcon(user.role)}
                      {user.role}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.vehiclePlate ? (
                      <div>
                        <div className="font-mono text-sm text-white">
                          {user.vehiclePlate}
                        </div>
                        <div className="text-[13px] text-slate-400">
                          {user.vehicleModel}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm italic text-slate-600">
                        No vehicle
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {user.lastActive}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${user.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : user.status === "Pending"
                          ? "bg-yellow-500/10 text-yellow-300"
                          : user.status === "Blacklisted"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${user.status === "Active"
                          ? "bg-emerald-400"
                          : user.status === "Pending"
                            ? "bg-yellow-300"
                            : user.status === "Blacklisted"
                              ? "bg-red-400"
                              : "bg-slate-400"
                          }`}
                      />
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(user, "view")}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => handleOpenModal(user, "edit")}
                        className="rounded-lg p-2 hover:bg-white/10 hover:text-blue-400 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="rounded-lg p-2 hover:bg-white/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No accounts found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
                <h3 className="text-xl font-semibold text-white">
                  {isViewMode ? "User Details" : editingUser ? "Edit User" : "Add New User"}
                </h3>
                <button onClick={handleCloseModal} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {isViewMode ? (
                <div className="flex flex-col h-full rounded-3xl bg-slate-950 overflow-hidden">
                  {/* Tabs Navigation */}
                  <div className="flex items-center gap-6 border-b border-white/10 px-8">
                    <button
                      onClick={() => setActiveTab("info")}
                      className={`relative py-4 text-sm font-medium transition-colors ${activeTab === "info"
                        ? "text-blue-400"
                        : "text-slate-400 hover:text-white"
                        }`}
                    >
                      User Information
                      {activeTab === "info" && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute -bottom-px left-0 right-0 h-0.5 bg-blue-500"
                        />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("history")}
                      className={`relative py-4 text-sm font-medium transition-colors ${activeTab === "history"
                        ? "text-blue-400"
                        : "text-slate-400 hover:text-white"
                        }`}
                    >
                      Activity History
                      {activeTab === "history" && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute -bottom-px left-0 right-0 h-0.5 bg-blue-500"
                        />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("images")}
                      className={`relative py-4 text-sm font-medium transition-colors ${activeTab === "images"
                        ? "text-blue-400"
                        : "text-slate-400 hover:text-white"
                        }`}
                    >
                      Vehicle Images
                      {activeTab === "images" && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute -bottom-px left-0 right-0 h-0.5 bg-blue-500"
                        />
                      )}
                    </button>
                  </div>

                  {activeTab === "info" && (
                    <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                      {/* Header summary */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-xl font-bold text-white">
                            {(formData.name || "U").toString().charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xl font-bold text-white">
                              {formData.name || "—"}
                            </div>
                            <div className="truncate text-sm text-slate-400">
                              {formData.email || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadge((formData.role || "Student") as UserRole)}`}>
                            {getRoleIcon((formData.role || "Student") as UserRole)}
                            {formData.role || "—"}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${formData.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : formData.status === "Pending"
                                ? "bg-yellow-500/10 text-yellow-300"
                                : formData.status === "Blacklisted"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-slate-500/10 text-slate-400"
                              }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${formData.status === "Active"
                                ? "bg-emerald-400"
                                : formData.status === "Pending"
                                  ? "bg-yellow-300"
                                  : formData.status === "Blacklisted"
                                    ? "bg-red-400"
                                    : "bg-slate-400"
                                }`}
                            />
                            {formData.status || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <h4 className="text-sm font-semibold text-white mb-3">User Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">User ID</span>
                              <span className="text-slate-200 font-medium">{editingUser?.id || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Name</span>
                              <span className="text-slate-200 font-medium">{formData.name || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Email</span>
                              <span className="text-slate-200 font-medium">{formData.email || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Role</span>
                              <span className="text-slate-200 font-medium">{formData.role || "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Last Active</span>
                              <span className="text-slate-200 font-medium">{editingUser?.lastActive || "—"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <h4 className="text-sm font-semibold text-white mb-3">Vehicle Information</h4>
                          {editingUser?.vehicles && editingUser.vehicles.length > 0 ? (
                            <div className="space-y-4">
                              {editingUser.vehicles.map((v: any, i: number) => (
                                <div key={i} className="space-y-2 text-sm pb-4 border-b border-white/5 last:border-0 last:pb-0">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">Plate Number</span>
                                    <span className="text-slate-200 font-medium">{v.plate_number}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">Vehicle Model</span>
                                    <span className="text-slate-200 font-medium">{v.model}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No registered vehicles.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <GlassButton type="button" variant="ghost" onClick={handleCloseModal}>
                          Close
                        </GlassButton>
                      </div>
                    </div>
                  )}

                  {activeTab === "history" && (
                    <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-white">Activity Logs</h4>
                        <GlassButton onClick={handleDownloadHistory} className="h-9 text-xs">
                          <Download className="mr-2 h-3.5 w-3.5" /> Download (.doc)
                        </GlassButton>
                      </div>

                      {/* Activity History Table */}
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <table className="w-full text-left text-sm text-slate-400">
                          <thead className="bg-white/5 text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Action</th>
                              <th className="px-4 py-3">Date & Time</th>
                              <th className="px-4 py-3">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {isLoadingLogs ? (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Loading activity...</td>
                              </tr>
                            ) : activityLogs.length > 0 ? (
                              activityLogs.map((log, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                  <td className="px-4 py-3 text-white font-medium">{log.action}</td>
                                  <td className="px-4 py-3">{log.time}</td>
                                  <td className="px-4 py-3">{log.details}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">No recent activity.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end pt-2">
                        <GlassButton type="button" variant="ghost" onClick={handleCloseModal}>
                          Close
                        </GlassButton>
                      </div>
                    </div>
                  )}

                  {activeTab === "images" && (
                    <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                      <h4 className="text-lg font-semibold text-white mb-4">Vehicle Plate Images</h4>

                      {isLoadingImages ? (
                        <div className="flex justify-center py-12 text-slate-500">Loading captured images...</div>
                      ) : vehicleImages.length > 0 ? (
                        <div className="space-y-8">
                          {vehicleImages.map((img, idx) => (
                            <div key={idx} className="space-y-4">
                              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                                <img
                                  src={img.url}
                                  alt="Vehicle Plate Capture"
                                  className="w-full h-auto object-contain max-h-[400px]"
                                />
                              </div>
                              <div className="flex items-center justify-between text-sm text-slate-400 px-1 border-b border-white/5 pb-6 last:border-0 last:pb-0">
                                <span>Captured on {img.date}</span>
                                <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded tracking-wider text-white">
                                  {img.plate}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-white/10 rounded-2xl bg-white/5">
                          <div className="p-4 rounded-full bg-slate-800/50 mb-4">
                            <img src="https://api.iconify.design/lucide:image-off.svg?color=%2364748b" className="w-8 h-8 opacity-50" />
                          </div>
                          <p>No vehicle plate images available recorded.</p>
                        </div>
                      )}

                      <div className="flex justify-end pt-4">
                        <GlassButton type="button" variant="ghost" onClick={handleCloseModal}>
                          Close
                        </GlassButton>
                      </div>
                    </div>
                  )}
                </div >
              ) : (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <GlassInput
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={false}
                    />
                    <GlassInput
                      placeholder="Email Address"
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={!!editingUser}
                      className={
                        editingUser
                          ? "opacity-50 cursor-not-allowed bg-white/5 border-transparent text-slate-400"
                          : ""
                      }
                    />
                  </div>

                  {editingUser && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
                      Note: <span className="text-slate-200 font-semibold">Email</span> and <span className="text-slate-200 font-semibold">Plate Number</span> are locked and can’t be updated.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 ml-1">Role</label>
                      <div className="relative">
                        <select
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-transparent text-slate-900 opacity-0"
                          value={formData.role}
                          onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                        >
                          <option value="Student">Student</option>
                          <option value="Professor">Professor</option>
                          <option value="Utility">Utility</option>
                          <option value="Admin">Admin</option>
                        </select>
                        <div className="pointer-events-none flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100">
                          <span className="text-left">{formData.role || "Student"}</span>
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 ml-1">Status</label>
                      <div className="relative">
                        <select
                          className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-transparent text-slate-900 opacity-0"
                          value={formData.status}
                          onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        >
                          <option value="Active">Active</option>
                          <option value="Pending">Pending</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Blacklisted">Blacklisted</option>
                        </select>
                        <div className="pointer-events-none flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100">
                          <span className="text-left">{formData.status || "Active"}</span>
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4 mt-2">
                    <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                      <Car className="h-4 w-4" /> Vehicle Information
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <GlassInput
                        placeholder="Plate Number"
                        value={formData.vehiclePlate}
                        onChange={e => setFormData({ ...formData, vehiclePlate: e.target.value })}
                        disabled={!!editingUser}
                        className={
                          editingUser
                            ? "opacity-50 cursor-not-allowed bg-white/5 border-transparent text-slate-400"
                            : ""
                        }
                      />
                      <GlassInput
                        placeholder="Vehicle Model"
                        value={formData.vehicleModel}
                        onChange={e => setFormData({ ...formData, vehicleModel: e.target.value })}
                        disabled={false}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <GlassButton type="button" variant="ghost" onClick={handleCloseModal}>
                      Cancel
                    </GlassButton>
                    <GlassButton type="submit">
                      {editingUser ? "Save Changes" : "Create Account"}
                    </GlassButton>
                  </div>
                </form>
              )}
            </motion.div >
          </div >
        )}
      </AnimatePresence >
    </div >
  );
};

export default AccountsPage;
