import React, { useState } from "react";
import DashboardLayout from "../../components/layout/dashboard-layout";
import { GlassCard, GlassButton } from "../../components/ui/glass-components";
import {
    Mail,
    Calendar,
    Shield,
    Clock,
    User,
    Phone,
    MapPin,
    Save,
    Camera,
    Edit2
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";

import { apiFetch } from "@/lib/api";

interface UserSettingsPageProps {
    userType?: "user" | "student" | "faculty" | "utility";
}

const UserSettingsPage: React.FC<UserSettingsPageProps> = ({ userType = "user" }) => {
    const { showNotification } = useNotification();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        location: "Quezon City, Philippines", // Default or fetch if added to DB
    });

    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Fetch Profile Data on Mount
    React.useEffect(() => {
        const loadProfileAndLogs = async () => {
            try {
                // Fetch Profile
                const res = await apiFetch("/auth/me");
                const user = res.user;
                if (user) {
                    setFormData({
                        fullName: user.name || "",
                        email: user.email || "",
                        phone: user.phone || "",
                        location: "Quezon City, Philippines",
                    });
                    if (user.profile_url) {
                        setProfileImage(user.profile_url);
                    }
                }
            } catch (error) {
                console.error("Failed to load profile and logs", error);
            }
        };
        loadProfileAndLogs();
    }, []);

    const handleUpdateProfile = async () => {
        setIsEditing(false);
        try {
            await apiFetch("/auth/update_profile", {
                method: "PUT",
                body: JSON.stringify({
                    name: formData.fullName,
                    phone: formData.phone,
                    profile_url: profileImage
                })
            });
            window.dispatchEvent(new Event("profileUpdate"));
            showNotification("Profile updated successfully!", "success");
        } catch (error) {
            console.error("Update Error:", error);
            showNotification("Failed to update profile", "error");
        }
    };

    // UI event handlers removed as per request to disable image uploading


    return (
        <DashboardLayout userType={userType}>
            <div className="space-y-6">
                {/* Gradient Header Card */}
                <GlassCard className="relative overflow-hidden p-0 group">
                    <div
                        className={`relative p-8 transition-all duration-300 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600`}
                    >
                        {/* Cover Photo Overlay */}
                        <div className="absolute inset-0 bg-black/0 transition-colors duration-300" />

                        <div className="flex items-center gap-6 relative z-10 pt-4">
                            <div className="relative group/profile">
                                <div
                                    className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm text-4xl font-bold text-white shadow-lg overflow-hidden"
                                >
                                    {profileImage ? (
                                        <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                                    ) : (
                                        formData.fullName ? formData.fullName[0].toUpperCase() : "U"
                                    )}
                                </div>
                            </div>

                            <div className="flex-1">
                                <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-md">{formData.fullName}</h2>
                                <div className="flex items-center gap-2 text-white/90 drop-shadow-sm">
                                    <Mail className="h-4 w-4" />
                                    <span className="text-lg">{formData.email}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* Three Info Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    <GlassCard className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Member Status</p>
                                <p className="text-lg font-bold text-white">Active</p>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account Type</p>
                                <p className="text-lg font-bold text-white capitalize">{userType}</p>
                            </div>
                        </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Active</p>
                                <p className="text-lg font-bold text-white">Today</p>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* Personal Information Form */}
                <GlassCard>
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-white mb-1">Personal Information</h3>
                        <p className="text-sm text-slate-400">Update your profile details</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Left Column */}
                        <div className="space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    disabled={!isEditing}
                                    className={`w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${!isEditing && "opacity-50 cursor-not-allowed"}`}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    Address
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    disabled={!isEditing}
                                    className={`w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${!isEditing && "opacity-50 cursor-not-allowed"}`}
                                />
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    disabled={!isEditing}
                                    className={`w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${!isEditing && "opacity-50 cursor-not-allowed"}`}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    Contact Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    disabled={!isEditing}
                                    className={`w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${!isEditing && "opacity-50 cursor-not-allowed"}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        {!isEditing ? (
                            <GlassButton className="flex items-center gap-2" onClick={() => setIsEditing(true)}>
                                <Edit2 className="h-4 w-4" />
                                Edit Profile
                            </GlassButton>
                        ) : (
                            <>
                                <GlassButton variant="ghost" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </GlassButton>
                                <GlassButton className="flex items-center gap-2" onClick={handleUpdateProfile}>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </GlassButton>
                            </>
                        )}
                    </div>
                </GlassCard>

            </div>
        </DashboardLayout>
    );
};

export default UserSettingsPage;
