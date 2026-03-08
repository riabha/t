import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    HiOutlineAcademicCap, HiOutlineSearch, HiOutlineUserGroup,
    HiOutlineOfficeBuilding, HiOutlineCalendar, HiOutlineArrowLeft
} from 'react-icons/hi';

const API_BASE = '/api/public';

export default function FacultyDirectoryPage() {
    const navigate = useNavigate();
    const [teachers, setTeachers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDept, setSelectedDept] = useState('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [teachersRes, deptsRes] = await Promise.all([
                axios.get(`${API_BASE}/teachers`),
                axios.get(`${API_BASE}/departments`)
            ]);
            setTeachers(teachersRes.data);
            setDepartments(deptsRes.data);
        } catch (err) {
            console.error('Failed to load faculty data:', err);
        }
        setLoading(false);
    };

    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.designation?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = selectedDept === 'all' || t.department_id === parseInt(selectedDept);
        return matchesSearch && matchesDept;
    });

    // Group teachers by department
    const teachersByDept = {};
    filteredTeachers.forEach(teacher => {
        const dept = departments.find(d => d.id === teacher.department_id);
        const deptName = dept?.name || 'Other';
        if (!teachersByDept[deptName]) {
            teachersByDept[deptName] = [];
        }
        teachersByDept[deptName].push(teacher);
    });

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Colorful Top Bar */}
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-violet-500 via-50% via-rose-500 to-amber-500" />

            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="QUEST Logo" className="w-12 h-12 object-contain" />
                            <div className="leading-tight">
                                <h1 className="font-display text-base font-extrabold text-slate-800">QUEST Faculty Directory</h1>
                                <p className="text-[10px] text-slate-400 font-medium">Quaid-e-Awam University</p>
                            </div>
                        </div>
                        <Link to="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium px-3 py-1.5">
                            <HiOutlineArrowLeft className="w-4 h-4" /> Back to Timetables
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <HiOutlineUserGroup className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="font-display text-3xl font-extrabold">Faculty Directory</h2>
                            <p className="text-blue-100 text-sm mt-1">Browse all faculty members and view their teaching schedules</p>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name or designation..."
                                className="w-full pl-12 pr-4 py-3 bg-white text-slate-800 border-0 rounded-xl text-sm font-medium shadow-lg focus:ring-4 focus:ring-amber-400 transition-all outline-none"
                            />
                        </div>
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="px-4 py-3 bg-white text-slate-800 border-0 rounded-xl text-sm font-bold shadow-lg focus:ring-4 focus:ring-amber-400 transition-all outline-none"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Faculty List */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-slate-500 font-medium text-sm">Loading faculty...</p>
                    </div>
                ) : filteredTeachers.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center mx-auto mb-4">
                            <HiOutlineSearch className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800">No Faculty Found</h4>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1.5 text-sm">Try adjusting your search or filter.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(teachersByDept).map(([deptName, deptTeachers]) => {
                            const dept = departments.find(d => d.name === deptName);
                            const colors = [
                                { bar: 'from-blue-500 to-blue-600', badge: 'bg-blue-100 text-blue-700', card: 'hover:border-blue-300' },
                                { bar: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-100 text-emerald-700', card: 'hover:border-emerald-300' },
                                { bar: 'from-amber-500 to-amber-600', badge: 'bg-amber-100 text-amber-700', card: 'hover:border-amber-300' },
                                { bar: 'from-rose-500 to-rose-600', badge: 'bg-rose-100 text-rose-700', card: 'hover:border-rose-300' },
                                { bar: 'from-violet-500 to-violet-600', badge: 'bg-violet-100 text-violet-700', card: 'hover:border-violet-300' },
                            ];
                            const colorIdx = dept ? dept.id % colors.length : 0;
                            const c = colors[colorIdx];

                            return (
                                <div key={deptName}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`w-1.5 h-10 rounded-full bg-gradient-to-b ${c.bar}`} />
                                        <div>
                                            <h3 className="text-lg font-display font-bold text-slate-800">{deptName}</h3>
                                            <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>
                                                {deptTeachers.length} Faculty
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {deptTeachers.map(teacher => (
                                            <div
                                                key={teacher.id}
                                                className={`bg-white rounded-xl border-2 border-slate-200 ${c.card} p-5 shadow-sm transition-all duration-200 hover:shadow-md`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.bar} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                                                        {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-800 text-sm truncate">{teacher.name}</h4>
                                                        {teacher.designation && (
                                                            <p className="text-xs text-slate-600 mt-1 font-medium">{teacher.designation}</p>
                                                        )}
                                                        {teacher.department_name && (
                                                            <p className="text-xs text-slate-500 mt-0.5">{teacher.department_name}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <Link
                                                        to={`/faculty/${teacher.id}`}
                                                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        <HiOutlineCalendar className="w-4 h-4" />
                                                        View Schedule
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Stats */}
                {!loading && filteredTeachers.length > 0 && (
                    <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
                        <span className="flex items-center gap-2">
                            <HiOutlineUserGroup className="w-4 h-4" />
                            {filteredTeachers.length} Faculty Members
                        </span>
                        <span className="flex items-center gap-2">
                            <HiOutlineOfficeBuilding className="w-4 h-4" />
                            {Object.keys(teachersByDept).length} Departments
                        </span>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-8 border-t border-slate-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <img src="/logo.png" alt="QUEST Logo" className="w-6 h-6 object-contain" />
                            <span>© {new Date().getFullYear()} QUEST Timetable Portal</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                            <Link to="/" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">Timetables</Link>
                            <span className="text-slate-300">·</span>
                            <Link to="/about" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">About</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
