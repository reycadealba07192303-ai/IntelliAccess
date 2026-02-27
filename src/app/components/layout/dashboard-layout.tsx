import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  FileText,
  Bell,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Users,
  ChevronDown,
  User,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "@/lib/api";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userType?: "admin" | "user" | "student" | "faculty" | "utility";
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, userType = "admin" }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState({
    name: "Loading...",
    role: "Loading...",
    initial: "?",
    profile_url: null as string | null
  });

  // Fetch Real Profile
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          navigate("/sign-in");
          return;
        }

        const res = await apiFetch("/auth/me");
        const user = res.user;

        if (user) {
          const name = user.name || user.email?.split('@')[0] || "User";
          const role = user.role || "User";
          const initial = name[0]?.toUpperCase() || "U";

          setUserInfo({
            name,
            role,
            initial,
            profile_url: user.profile_url || null
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setUserInfo({
          name: "User",
          role: "User",
          initial: "U",
          profile_url: null
        });
        // In real app, might want to redirect if token invalid
        navigate("/sign-in");
      }
    };

    fetchProfile();

    const handleProfileUpdate = (e: any) => {
      // If the event provides the new image base64 directly, use it immediately
      if (e instanceof CustomEvent && e.detail) {
        setUserInfo((prev) => ({ ...prev, profile_url: e.detail }));
      } else {
        fetchProfile();
      }
    };

    window.addEventListener("profileUpdate", handleProfileUpdate);
    return () => window.removeEventListener("profileUpdate", handleProfileUpdate);
  }, [navigate]);

  const [notificationsData, setNotificationsData] = useState<any[]>([]);

  // Fetch Notifications (Recent Logs)
  React.useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        // Admin gets all notifications, users get their own + global
        const endpoint = userType === "admin" ? "/notifications/?limit=5" : "/notifications/me?limit=5";
        const res = await apiFetch(endpoint);

        const formattedNotifications = res.map((notif: any) => ({
          id: notif.id,
          title: notif.title,
          message: notif.message,
          time: new Date(notif.created_at + (notif.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString(),
          read: notif.read,
          type: notif.type,
          profile_url: notif.profile_url || null
        }));
        setNotificationsData(formattedNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
  }, [userType]);

  const getNavItems = () => {
    if (userType === "admin") {
      return [
        { label: "Overview", icon: LayoutDashboard, path: "/admin" },
        { label: "Accounts", icon: Users, path: "/admin/accounts" },
        { label: "Vehicles", icon: Car, path: "/admin/vehicles" },
        { label: "Access Logs", icon: FileText, path: "/admin/logs" },
        { label: "Camera", icon: Camera, path: "/admin/camera" },
        { label: "Notifications", icon: Bell, path: "/admin/notifications" },
        { label: "Account Profile", icon: User, path: "/admin/settings" },
      ];
    }

    const basePath = `/${userType}`;

    // Capitalize the first letter for display
    const typeLabel = userType ? userType.charAt(0).toUpperCase() + userType.slice(1) : "User";

    return [
      { label: `My Vehicles`, icon: Car, path: basePath },
      { label: `My Logs`, icon: FileText, path: `${basePath}/logs` },
      { label: `Notifications`, icon: Bell, path: `${basePath}/notifications` },
      { label: `${typeLabel} Profile`, icon: User, path: `${basePath}/settings` },
    ];
  };

  const navItems = getNavItems();

  const handleMarkAllRead = () => {
    setNotificationsData(notificationsData.map(n => ({ ...n, read: true })));
  };

  const handleViewAllNotifications = () => {
    setIsNotificationsOpen(false);
    navigate(userType === "admin" ? "/admin/notifications" : "/dashboard/notifications");
  };

  return (
    <div className="h-screen bg-[#0f172a] text-white flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900/90 backdrop-blur-xl border-r border-white/10 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-500" />
            <span className="text-lg font-bold tracking-tight">IntelliAccess</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex h-[calc(100vh-4rem)] flex-col justify-between">
          <nav className="flex flex-col gap-2 p-4">
            <div className="mb-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Menu
            </div>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all ${isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-600/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 text-xs text-slate-500">
            IntelliAccess {userType === 'admin' ? 'Admin' : 'User'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden relative lg:ml-64">
        {/* Background Subtle Gradient */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl opacity-50" />
        </div>

        {/* Top Header */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-slate-900/50 px-6 backdrop-blur-md">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-400 hover:text-white lg:hidden">
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden md:flex items-center w-full max-w-md ml-4">
            {/* Search removed at user request */}
          </div>

          <div className="relative flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors focus:outline-none"
              >
                <Bell className="h-5 w-5" />
                {notificationsData.some(n => !n.read) && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                )}
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[90]"
                      onClick={() => setIsNotificationsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-12 z-[100] w-80 rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="font-semibold text-white">Notifications</h3>
                        <span
                          onClick={handleMarkAllRead}
                          className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                        >
                          Mark all as read
                        </span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notificationsData.length === 0 ? (
                          <div className="p-4 text-center text-sm text-slate-500">
                            No new notifications
                          </div>
                        ) : (
                          notificationsData.map((notification) => (
                            <div
                              key={notification.id}
                              className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-500/5' : ''}`}
                            >
                              <div className="flex justify-between items-start gap-3">
                                {notification.profile_url ? (
                                  <img src={notification.profile_url} alt="Profile" className="h-8 w-8 rounded-full object-cover shrink-0 mt-1" />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-1">
                                    <Bell className="h-4 w-4 text-slate-400" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-slate-200 mb-1">{notification.title}</p>
                                  <p className="text-xs text-slate-400 line-clamp-2">{notification.message}</p>
                                  <p className="text-[10px] text-slate-500 mt-2">{notification.time}</p>
                                </div>
                                {!notification.read && (
                                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-3 text-center border-t border-white/10">
                        <button
                          onClick={handleViewAllNotifications}
                          className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          View all notifications
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setIsProfileMenuOpen((open) => !open)}
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 ring-2 ring-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/60 overflow-hidden"
            >
              {userInfo.profile_url ? (
                <img src={userInfo.profile_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-white">{userInfo.initial}</span>
              )}
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 top-10 z-[100] w-56 rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-xl">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 text-xs font-semibold overflow-hidden">
                    {userInfo.profile_url ? (
                      <img src={userInfo.profile_url} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      userInfo.initial
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-100">
                      {userInfo.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {userInfo.role}
                    </span>
                  </div>
                </div>
                <div className="my-1 h-px bg-white/10" />
                <Link
                  to={userType === "admin" ? "/admin/settings#profile" : "/dashboard/settings#profile"}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <span>My Profile</span>
                  <ChevronDown className="h-3 w-3 rotate-90 text-slate-500" />
                </Link>
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    window.location.href = "/sign-in";
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative z-10">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
