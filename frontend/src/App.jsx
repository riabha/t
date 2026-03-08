import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import SectionsPage from './pages/SectionsPage';
import UsersPage from './pages/UsersPage';
import RestrictionsPage from './pages/RestrictionsPage';
import LabSettingsPage from './pages/LabSettingsPage';
import PublicTimetablePage from './pages/PublicTimetablePage';
import FacultyDirectoryPage from './pages/FacultyDirectoryPage';
import TeacherSchedulePage from './pages/TeacherSchedulePage';
import VCMasterDashboard from './pages/VCMasterDashboard';
import DashboardHome from './pages/DashboardHome';
import TeachersPage from './pages/TeachersPage';
import SubjectsPage from './pages/SubjectsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import RoomsPage from './pages/RoomsPage';
import TimetablePage from './pages/TimetablePage';
import ManualTimetablePage from './pages/ManualTimetablePage';
import MySchedulePage from './pages/MySchedulePage';
import MyAssignmentsPage from './pages/MyAssignmentsPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import TestPage from './pages/TestPage';
import DebugPage from './pages/DebugPage';

function ProtectedRoute({ children }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    return children;
}

function AppRoutes() {
    const { user } = useAuth();

    return (
        <Routes>
            {/* Test route */}
            <Route path="/test" element={<TestPage />} />
            
            {/* Public landing page — no login required */}
            <Route path="/" element={<PublicTimetablePage />} />
            <Route path="/faculty" element={<FacultyDirectoryPage />} />
            <Route path="/faculty/:teacherId" element={<TeacherSchedulePage />} />

            {/* Auth */}
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
            <Route path="/about" element={<AboutPage />} />

            {/* Protected admin dashboard */}
            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <DashboardLayout />
                </ProtectedRoute>
            }>
                <Route index element={<DashboardHome />} />
                <Route path="vc-master" element={<VCMasterDashboard />} />
                <Route path="teachers" element={<TeachersPage />} />
                <Route path="subjects" element={<SubjectsPage />} />
                <Route path="sections" element={<SectionsPage />} />
                <Route path="assignments" element={<AssignmentsPage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="timetable" element={<TimetablePage />} />
                <Route path="manual-timetable" element={<ManualTimetablePage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="restrictions" element={<RestrictionsPage />} />
                <Route path="lab-settings" element={<LabSettingsPage />} />
                <Route path="my-schedule" element={<MySchedulePage />} />
                <Route path="my-assignments" element={<MyAssignmentsPage />} />
                <Route path="debug" element={<DebugPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
