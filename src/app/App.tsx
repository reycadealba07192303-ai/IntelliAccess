import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationProvider } from "./context/NotificationContext";
import LandingPage from "./pages/landing";
import SignInPage from "./pages/auth/sign-in";
import SignUpPage from "./pages/auth/sign-up";
import ForgotPasswordPage from "./pages/auth/forgot-password";

// Admin Pages
import AdminDashboard from "./pages/dashboard/admin-dashboard";
import AccountsPage from "./pages/admin/accounts";
import VehiclesPage from "./pages/admin/vehicles";
import LogsPage from "./pages/admin/logs";
import NotificationsPage from "./pages/admin/notifications";
import SettingsPage from "./pages/admin/settings";
import CameraPage from "./pages/admin/camera";

// User Pages
import UserDashboard from "./pages/dashboard/user-dashboard";
import UserLogsPage from "./pages/dashboard/user-logs";
import UserSettingsPage from "./pages/dashboard/user-settings";
import UserNotificationsPage from "./pages/dashboard/user-notifications";

function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/accounts" element={
            <AdminDashboard>
              <AccountsPage />
            </AdminDashboard>
          } />
          <Route path="/admin/vehicles" element={
            <AdminDashboard>
              <VehiclesPage />
            </AdminDashboard>
          } />
          <Route path="/admin/logs" element={
            <AdminDashboard>
              <LogsPage />
            </AdminDashboard>
          } />
          <Route path="/admin/notifications" element={
            <AdminDashboard>
              <NotificationsPage />
            </AdminDashboard>
          } />
          <Route path="/admin/settings" element={
            <AdminDashboard>
              <SettingsPage />
            </AdminDashboard>
          } />
          <Route path="/admin/camera" element={
            <AdminDashboard>
              <CameraPage />
            </AdminDashboard>
          } />

          {/* Student Routes */}
          <Route path="/student" element={<UserDashboard userType="student" />} />
          <Route path="/student/logs" element={<UserLogsPage userType="student" />} />
          <Route path="/student/settings" element={<UserSettingsPage userType="student" />} />
          <Route path="/student/notifications" element={<UserNotificationsPage userType="student" />} />

          {/* Faculty Routes */}
          <Route path="/faculty" element={<UserDashboard userType="faculty" />} />
          <Route path="/faculty/logs" element={<UserLogsPage userType="faculty" />} />
          <Route path="/faculty/settings" element={<UserSettingsPage userType="faculty" />} />
          <Route path="/faculty/notifications" element={<UserNotificationsPage userType="faculty" />} />

          {/* Utility/Staff Routes */}
          <Route path="/utility" element={<UserDashboard userType="utility" />} />
          <Route path="/utility/logs" element={<UserLogsPage userType="utility" />} />
          <Route path="/utility/settings" element={<UserSettingsPage userType="utility" />} />
          <Route path="/utility/notifications" element={<UserNotificationsPage userType="utility" />} />

          {/* Legacy / Fallback User Routes */}
          <Route path="/dashboard" element={<Navigate to="/student" replace />} />
          <Route path="/dashboard/logs" element={<Navigate to="/student/logs" replace />} />
          <Route path="/dashboard/settings" element={<Navigate to="/student/settings" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
