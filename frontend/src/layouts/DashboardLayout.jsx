import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineHome, HiOutlineUsers, HiOutlineBookOpen,
    HiOutlineCalendar, HiOutlineLink, HiOutlineOfficeBuilding,
    HiOutlineClock, HiOutlineLogout, HiOutlineMenu, HiOutlineX,
    HiOutlineCollection, HiOutlineUserGroup, HiOutlineLibrary,
    HiOutlineClipboardList, HiOutlineLockClosed, HiChevronDoubleLeft, HiChevronDoubleRight, HiOutlineAdjustments, HiOutlineBeaker, HiOutlineChartBar, HiOutlineAcademicCap, HiOutlineUserCircle
} from 'react-icons/hi';

export default function DashboardLayout() {
    const { logout, user, canManageRestrictions } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const navItems = [
        { name: 'Home', path: '/dashboard', icon: <HiOutlineHome className="w-5 h-5" />, roles: ['super_admin', 'program_admin', 'clerk', 'teacher', 'lab_engineer'] },
        { name: 'VC Master Dashboard', path: '/dashboard/vc-master', icon: <HiOutlineChartBar className="w-5 h-5" />, roles: ['vc'], highlight: true },
        { name: 'VC Master View', path: '/dashboard/vc-master', icon: <HiOutlineChartBar className="w-5 h-5" />, roles: ['super_admin'], highlight: true },
        { name: 'Timetable', path: '/dashboard/timetable', icon: <HiOutlineCalendar className="w-5 h-5" />, roles: ['super_admin', 'program_admin'] },
        { name: 'Manual Editor', path: '/dashboard/manual-timetable', icon: <HiOutlineAdjustments className="w-5 h-5" />, roles: ['super_admin', 'program_admin'] },
        { name: 'Batches', path: '/dashboard/sections', icon: <HiOutlineCollection className="w-5 h-5" />, roles: ['super_admin', 'program_admin'] },
        { name: 'Teachers', path: '/dashboard/teachers', icon: <HiOutlineUserGroup className="w-5 h-5" />, roles: ['super_admin', 'program_admin', 'clerk'] },
        { name: 'Subjects', path: '/dashboard/subjects', icon: <HiOutlineBookOpen className="w-5 h-5" />, roles: ['super_admin', 'program_admin', 'clerk'] },
        { name: 'Rooms', path: '/dashboard/rooms', icon: <HiOutlineLibrary className="w-5 h-5" />, roles: ['super_admin', 'program_admin'] },
        { name: 'Departments', path: '/dashboard/departments', icon: <HiOutlineOfficeBuilding className="w-5 h-5" />, roles: ['super_admin'] },
        { name: 'Assignments', path: '/dashboard/assignments', icon: <HiOutlineClipboardList className="w-5 h-5" />, roles: ['super_admin', 'program_admin', 'clerk'] },
        { name: 'Students', path: '/dashboard/students', icon: <HiOutlineUserCircle className="w-5 h-5" />, roles: ['super_admin', 'program_admin', 'clerk'] },
        { name: 'Makeup Classes', path: '/dashboard/makeup', icon: <HiOutlineAcademicCap className="w-5 h-5" />, roles: ['super_admin', 'program_admin', 'clerk'] },
        { name: 'Restrictions', path: '/dashboard/restrictions', icon: <HiOutlineLockClosed className="w-5 h-5" />, roles: ['super_admin', 'program_admin'], requiresPermission: 'restrictions' },
        { name: 'Lab Settings', path: '/dashboard/lab-settings', icon: <HiOutlineBeaker className="w-5 h-5" />, roles: ['super_admin', 'program_admin'] },
        { name: 'User Management', path: '/dashboard/users', icon: <HiOutlineUserGroup className="w-5 h-5" />, roles: ['super_admin'] },
        { name: 'My Schedule', path: '/dashboard/my-schedule', icon: <HiOutlineClock className="w-5 h-5" />, roles: ['teacher', 'lab_engineer'] },
        { name: 'My Assignments', path: '/dashboard/my-assignments', icon: <HiOutlineClipboardList className="w-5 h-5" />, roles: ['teacher', 'lab_engineer'] },
        { name: 'Debug Info', path: '/dashboard/debug', icon: <HiOutlineAdjustments className="w-5 h-5" />, roles: ['teacher', 'lab_engineer'] },
        { name: 'Solver Settings', path: '/dashboard/settings', icon: <HiOutlineAdjustments className="w-5 h-5" />, roles: ['super_admin', 'program_admin'] },
    ];

    const filteredNav = navItems.filter(item => {
        if (!user) return false;
        if (!item.roles.includes(user.role)) return false;
        // Additional permission checks
        if (item.requiresPermission === 'restrictions' && user.role === 'program_admin' && !canManageRestrictions) return false;
        return true;
    });

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const sidebarContent = (
        <div className={`flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}>
            {/* Logo */}
            <div className={`p-6 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20 shrink-0">
                    <HiOutlineCalendar className="w-6 h-6" />
                </div>
                {!collapsed && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">Admin</h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Timetable Portal</p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4 custom-scrollbar">
                {filteredNav.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/dashboard'}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all group
                            ${isActive
                                ? 'bg-primary-50 text-primary-600 shadow-sm shadow-primary-500/5'
                                : item.highlight 
                                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-lg'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
                            ${collapsed ? 'justify-center px-0' : ''}
                        `}
                        onClick={() => setSidebarOpen(false)}
                        title={collapsed ? item.name : ''}
                    >
                        <div className="group-hover:scale-110 transition-transform duration-200">
                            {item.icon}
                        </div>
                        {!collapsed && <span className="animate-in fade-in duration-300">{item.name}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Collapse Toggle (Desktop) */}
            <div className="hidden lg:block px-4 py-2">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                >
                    {collapsed ? <HiChevronDoubleRight className="w-5 h-5" /> : <HiChevronDoubleLeft className="w-5 h-5" />}
                </button>
            </div>

            {/* User Profile / Logout */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'px-4 py-3'}`}>
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold ring-2 ring-white shrink-0 shadow-sm">
                        {user?.username ? user.username.substring(0, 2).toUpperCase() : '??'}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                            <p className="text-xs font-bold text-slate-800 truncate">{user?.full_name || 'Admin User'}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{(user?.role || 'user').replace('_', ' ')}</p>
                        </div>
                    )}
                    {!collapsed && (
                        <button
                            onClick={handleLogout}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Logout"
                        >
                            <HiOutlineLogout className="w-5 h-5" />
                        </button>
                    )}
                </div>
                {collapsed && (
                    <button
                        onClick={handleLogout}
                        className="mt-2 w-full flex items-center justify-center p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Logout"
                    >
                        <HiOutlineLogout className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            {/* Desktop Sidebar */}
            <div className={`hidden lg:block h-full transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}>
                {sidebarContent}
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
                    <div className="fixed top-0 left-0 bottom-0 w-72 animate-in slide-in-from-left duration-300">
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-500">
                        <HiOutlineMenu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center text-white">
                            <HiOutlineCalendar className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Timetable Portal</span>
                    </div>
                    <div className="w-10"></div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
