import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlineUsers, HiOutlineBookOpen, HiOutlineOfficeBuilding, HiOutlineCalendar, HiOutlinePlus, HiOutlineSparkles, HiOutlineTrash, HiOutlineChartBar, HiOutlineCheckCircle, HiOutlineExclamation } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardHome() {
    const { user, isSuperAdmin, canDeleteTimetable } = useAuth();
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    // Redirect VC users to VC Master Dashboard
    useEffect(() => {
        if (user?.role === 'vc') {
            navigate('/dashboard/vc-master', { replace: true });
        }
    }, [user, navigate]);

    const loadData = async () => {
        try {
            const res = await api.get('/dashboard/summary');
            setSummary(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this timetable?')) return;
        try {
            await api.delete(`/timetable/${id}`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.detail || 'Delete failed');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    const stats = [
        { label: 'Total Teachers', value: summary?.stats?.teachers || 0, icon: HiOutlineUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active Subjects', value: summary?.stats?.subjects || 0, icon: HiOutlineBookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Available Rooms', value: summary?.stats?.rooms || 0, icon: HiOutlineOfficeBuilding, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Generated TTs', value: summary?.stats?.timetables || 0, icon: HiOutlineCalendar, color: 'text-violet-600', bg: 'bg-violet-50' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Hero Section - Improved */}
            <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-2xl">
                <div className="relative z-10 max-w-3xl">
                    <div className="flex items-center gap-3 mb-3">
                        <HiOutlineSparkles className="text-yellow-300 w-8 h-8" />
                        <h1 className="text-4xl font-black">
                            Welcome back, {user?.full_name || 'Admin'}!
                        </h1>
                    </div>
                    <p className="text-white/90 text-lg mb-6 font-medium">
                        The timetable engine is running smoothly. You have <span className="font-black text-yellow-300">{summary?.stats?.timetables || 0}</span> active schedules for the current semester.
                    </p>
                    <div className="flex gap-4">
                        <NavLink to="/dashboard/timetable" className="px-6 py-3 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl transform hover:scale-105">
                            Manage Timetables
                        </NavLink>
                    </div>
                </div>
                {/* Decorative background elements */}
                <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-20%] left-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            {/* Stats Grid - Improved */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="premium-card p-6 flex items-center gap-4 hover:shadow-xl transition-all transform hover:scale-105">
                        <div className={`w-16 h-16 rounded-2xl ${bg} ${color} flex items-center justify-center shadow-lg`}>
                            <Icon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-800 leading-tight">{value}</p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Teacher Workload Chart - Color-coded by utilization */}
                <div className="lg:col-span-2 premium-card p-6 hover:shadow-xl transition-shadow">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-800">Teacher Workload Distribution</h2>
                            <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">
                                {!isSuperAdmin ? 'Current Hours vs Max Capacity' : 'Credits per Department'}
                            </p>
                        </div>
                        {!isSuperAdmin && summary?.teacher_workload && (
                            <div className="flex gap-3 text-xs font-bold">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-red-500"></div>
                                    <span>Overloaded</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-amber-500"></div>
                                    <span>Near Capacity</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-emerald-500"></div>
                                    <span>Optimal</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                                    <span>Available</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {!isSuperAdmin && summary?.teacher_workload && summary.teacher_workload.length > 0 ? (
                        <div style={{ height: '400px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summary.teacher_workload} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                                        tickLine={false}
                                        tick={false}
                                        height={5}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                        label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 12, fontWeight: 700, fill: '#64748b' } }}
                                    />
                                    <Tooltip
                                        contentStyle={{ 
                                            borderRadius: '12px', 
                                            border: 'none', 
                                            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.2)',
                                            fontWeight: 'bold'
                                        }}
                                        cursor={{ fill: '#f1f5f9' }}
                                        formatter={(value, name, props) => {
                                            const teacher = props.payload;
                                            return [
                                                `${teacher.current_hours}/${teacher.max_hours} hours (${teacher.utilization}%)`,
                                                teacher.name
                                            ];
                                        }}
                                    />
                                    <Bar dataKey="current_hours" radius={[8, 8, 0, 0]} barSize={30} fillOpacity={0.85}>
                                        {summary.teacher_workload.map((teacher, index) => {
                                            let color = '#3b82f6'; // Blue - underutilized
                                            if (teacher.utilization > 100) {
                                                color = '#ef4444'; // Red - overloaded
                                            } else if (teacher.utilization >= 80) {
                                                color = '#f59e0b'; // Amber - near capacity
                                            } else if (teacher.utilization >= 50) {
                                                color = '#10b981'; // Green - optimal
                                            }
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : isSuperAdmin && summary?.workload_distribution && summary.workload_distribution.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={summary.workload_distribution}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="dept_code"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#475569', fontSize: 13, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ 
                                            borderRadius: '12px', 
                                            border: 'none', 
                                            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.2)',
                                            fontWeight: 'bold'
                                        }}
                                        cursor={{ fill: '#f1f5f9' }}
                                    />
                                    <Bar dataKey="total_hours" radius={[12, 12, 0, 0]} barSize={50}>
                                        {summary.workload_distribution.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'][index % 6]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center">
                            <p className="text-slate-400 text-sm italic">No workload data available</p>
                        </div>
                    )}
                </div>

                {/* Recent Activities - Improved */}
                <div className="premium-card p-6 hover:shadow-xl transition-shadow">
                    <h2 className="text-xl font-black text-slate-800 mb-6">Recent Timetables</h2>
                    <div className="space-y-3">
                        {(!summary || (summary.recent_timetables || []).length === 0) ? (
                            <div className="text-center py-12">
                                <HiOutlineCalendar className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-400 text-sm font-medium">No timetables yet</p>
                                <p className="text-slate-400 text-xs mt-1">Create your first timetable to get started</p>
                            </div>
                        ) : (
                            summary.recent_timetables.map(tt => (
                                <div key={tt.id} className="group flex items-center gap-3 p-4 rounded-xl hover:bg-gradient-to-r hover:from-slate-50 hover:to-white transition-all border border-slate-100 hover:border-primary-200 hover:shadow-md">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                        <HiOutlineCalendar className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{tt.name}</p>
                                        <p className="text-xs text-slate-500 font-medium">{new Date(tt.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm
                                                        ${tt.status === 'active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                            {tt.status}
                                        </div>
                                        {canDeleteTimetable && (
                                            <button
                                                onClick={(e) => handleDelete(e, tt.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Delete"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <NavLink to="/dashboard/timetable" className="mt-6 block text-center text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors py-2 px-4 rounded-xl hover:bg-indigo-50">
                        View All Timetables →
                    </NavLink>
                </div>
            </div>

            {/* Comprehensive Data Section - Only for Program Admins */}
            {!isSuperAdmin && summary?.teacher_workload && (
                <>
                    {/* Assignment Coverage & Teacher Utilization */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Assignment Coverage */}
                        {summary.assignment_coverage && (
                            <div className="premium-card p-6 hover:shadow-xl transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <HiOutlineCheckCircle className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800">Assignment Coverage</h2>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Subject Assignment Status</p>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="flex items-end gap-4 mb-4">
                                        <div className="text-5xl font-black text-emerald-600">
                                            {summary.assignment_coverage.percentage}%
                                        </div>
                                        <div className="text-sm text-slate-600 mb-2">
                                            <span className="font-bold">{summary.assignment_coverage.assigned}</span> of{' '}
                                            <span className="font-bold">{summary.assignment_coverage.total}</span> subjects assigned
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                                            style={{ width: `${summary.assignment_coverage.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Teacher Utilization */}
                        {summary.teacher_utilization && (
                            <div className="premium-card p-6 hover:shadow-xl transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                                        <HiOutlineChartBar className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800">Teacher Utilization</h2>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Workload Distribution</p>
                                    </div>
                                </div>
                                <div className="space-y-4 mt-6">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineExclamation className="w-5 h-5 text-amber-600" />
                                            <span className="text-sm font-bold text-slate-700">Underutilized (&lt;50%)</span>
                                        </div>
                                        <span className="text-2xl font-black text-amber-600">{summary.teacher_utilization.underutilized}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
                                            <span className="text-sm font-bold text-slate-700">Optimal (50-90%)</span>
                                        </div>
                                        <span className="text-2xl font-black text-emerald-600">{summary.teacher_utilization.optimal}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineExclamation className="w-5 h-5 text-red-600" />
                                            <span className="text-sm font-bold text-slate-700">Overloaded (&gt;90%)</span>
                                        </div>
                                        <span className="text-2xl font-black text-red-600">{summary.teacher_utilization.overloaded}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Teacher Workload Details & Subject Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Teacher Workload Table */}
                        <div className="lg:col-span-2 premium-card p-6 hover:shadow-xl transition-shadow">
                            <h2 className="text-xl font-black text-slate-800 mb-6">Teacher Workload Details</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200">
                                            <th className="text-left py-3 px-2 text-xs font-black text-slate-600 uppercase tracking-wider">Teacher</th>
                                            <th className="text-center py-3 px-2 text-xs font-black text-slate-600 uppercase tracking-wider">Hours</th>
                                            <th className="text-center py-3 px-2 text-xs font-black text-slate-600 uppercase tracking-wider">Utilization</th>
                                            <th className="text-center py-3 px-2 text-xs font-black text-slate-600 uppercase tracking-wider">Assignments</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.teacher_workload.slice(0, 10).map((teacher, idx) => (
                                            <tr key={teacher.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-2 text-sm font-medium text-slate-800">{teacher.name}</td>
                                                <td className="py-3 px-2 text-center">
                                                    <span className="text-sm font-bold text-slate-700">
                                                        {teacher.current_hours}/{teacher.max_hours}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black
                                                        ${teacher.utilization > 90 ? 'bg-red-100 text-red-700' : 
                                                          teacher.utilization >= 50 ? 'bg-emerald-100 text-emerald-700' : 
                                                          'bg-amber-100 text-amber-700'}`}>
                                                        {teacher.utilization}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-center text-sm font-bold text-slate-600">
                                                    {teacher.assignments_count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {summary.teacher_workload.length > 10 && (
                                    <div className="mt-4 text-center">
                                        <NavLink to="/dashboard/teachers" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
                                            View All {summary.teacher_workload.length} Teachers →
                                        </NavLink>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subject Distribution by Semester */}
                        {summary.subject_distribution && summary.subject_distribution.length > 0 && (
                            <div className="premium-card p-6 hover:shadow-xl transition-shadow">
                                <h2 className="text-xl font-black text-slate-800 mb-6">Subjects by Semester</h2>
                                <div className="space-y-3">
                                    {summary.subject_distribution.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <span className="text-sm font-bold text-slate-700">
                                                {item.semester ? `Semester ${item.semester}` : 'No Semester'}
                                            </span>
                                            <span className="text-lg font-black text-indigo-600">{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
