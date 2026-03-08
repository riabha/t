import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
    HiOutlineArrowLeft, HiOutlineCalendar, HiOutlineMail,
    HiOutlineOfficeBuilding, HiOutlineAcademicCap
} from 'react-icons/hi';

const API_BASE = '/api/public';

export default function TeacherSchedulePage() {
    const { teacherId } = useParams();
    const [teacher, setTeacher] = useState(null);
    const [schedule, setSchedule] = useState(null);
    const [timetables, setTimetables] = useState([]);
    const [selectedTT, setSelectedTT] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [teacherId]);

    useEffect(() => {
        if (selectedTT) {
            loadSchedule(selectedTT);
        }
    }, [selectedTT]);

    const loadData = async () => {
        try {
            const [teacherRes, ttRes] = await Promise.all([
                axios.get(`${API_BASE}/teachers/${teacherId}`),
                axios.get(`${API_BASE}/timetables`)
            ]);
            setTeacher(teacherRes.data);
            
            // Filter active timetables
            const activeTTs = ttRes.data.filter(t => t.status !== 'archived');
            setTimetables(activeTTs);
            
            if (activeTTs.length > 0) {
                setSelectedTT(activeTTs[0].id.toString());
            }
        } catch (err) {
            console.error('Failed to load teacher data:', err);
        }
        setLoading(false);
    };

    const loadSchedule = async (ttId) => {
        try {
            const res = await axios.get(`${API_BASE}/timetables/${ttId}/teacher/${teacherId}`);
            console.log('Teacher schedule loaded:', res.data);
            setSchedule(res.data);
        } catch (err) {
            console.error('Failed to load schedule:', err);
            console.error('Error response:', err.response?.data);
            setSchedule({ slots: [] }); // Set empty schedule instead of null
        }
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const slots = [0, 1, 2, 3, 4, 5, 6, 7];

    const getSlot = (day, slotIndex) => {
        if (!schedule || !schedule.slots) return null;
        return schedule.slots.find(s => s.day === day && s.slot_index === slotIndex);
    };

    const getColorForSection = (sectionName) => {
        const hash = sectionName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const colors = [
            { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
            { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700' },
            { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700' },
            { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
            { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
        ];
        return colors[hash % colors.length];
    };

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
                                <h1 className="font-display text-base font-extrabold text-slate-800">Faculty Schedule</h1>
                                <p className="text-[10px] text-slate-400 font-medium">Quaid-e-Awam University</p>
                            </div>
                        </div>
                        <Link to="/faculty" className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium px-3 py-1.5">
                            <HiOutlineArrowLeft className="w-4 h-4" /> Back to Directory
                        </Link>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-slate-500 font-medium text-sm">Loading schedule...</p>
                </div>
            ) : teacher ? (
                <>
                    {/* Teacher Info */}
                    <div className="bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 text-white">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                            <div className="flex items-start gap-6">
                                <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                                    {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div className="flex-1">
                                    <h2 className="font-display text-3xl font-extrabold mb-2">{teacher.name}</h2>
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        {teacher.designation && (
                                            <span className="flex items-center gap-2">
                                                <HiOutlineAcademicCap className="w-4 h-4" />
                                                {teacher.designation}
                                            </span>
                                        )}
                                        {teacher.department_name && (
                                            <span className="flex items-center gap-2">
                                                <HiOutlineOfficeBuilding className="w-4 h-4" />
                                                {teacher.department_name}
                                            </span>
                                        )}
                                        {teacher.email && (
                                            <span className="flex items-center gap-2">
                                                <HiOutlineMail className="w-4 h-4" />
                                                {teacher.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Timetable Selector */}
                            {timetables.length > 0 && (
                                <div className="mt-6">
                                    <label className="block text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Select Timetable</label>
                                    <select
                                        value={selectedTT}
                                        onChange={(e) => setSelectedTT(e.target.value)}
                                        className="px-4 py-3 bg-white text-slate-800 border-0 rounded-xl text-sm font-bold shadow-lg focus:ring-4 focus:ring-amber-400 transition-all outline-none"
                                    >
                                        {timetables.map(tt => (
                                            <option key={tt.id} value={tt.id}>{tt.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Schedule Grid */}
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {schedule && schedule.slots && schedule.slots.length > 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100">
                                                <th className="border border-slate-200 p-3 text-left text-xs font-bold text-slate-700 w-24">Day</th>
                                                {slots.map(s => (
                                                    <th key={s} className="border border-slate-200 p-3 text-center text-xs font-bold text-slate-700 min-w-[120px]">
                                                        Slot {s + 1}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {days.map((day, dayIdx) => (
                                                <tr key={dayIdx}>
                                                    <td className="border border-slate-200 p-3 bg-slate-50 font-bold text-sm text-slate-700">
                                                        {day}
                                                    </td>
                                                    {slots.map(slotIdx => {
                                                        const slot = getSlot(dayIdx, slotIdx);
                                                        if (!slot || slot.is_break) {
                                                            return (
                                                                <td key={slotIdx} className="border border-slate-200 p-3 bg-slate-50/50">
                                                                    {slot?.is_break && (
                                                                        <div className="text-xs text-amber-600 font-bold text-center">BREAK</div>
                                                                    )}
                                                                </td>
                                                            );
                                                        }

                                                        const color = getColorForSection(slot.section_name || '');
                                                        return (
                                                            <td key={slotIdx} className={`border border-slate-200 p-2 ${color.bg}`}>
                                                                <div className="text-xs space-y-1">
                                                                    <div className={`font-bold ${color.text}`}>
                                                                        {slot.subject_code}
                                                                        {slot.is_lab && <span className="ml-1">(Lab)</span>}
                                                                    </div>
                                                                    <div className="text-slate-600 font-medium">{slot.section_name}</div>
                                                                    {slot.room_name && (
                                                                        <div className="text-slate-500">{slot.room_name}</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center mx-auto mb-4">
                                    <HiOutlineCalendar className="w-8 h-8 text-blue-500" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-800">No Schedule Available</h4>
                                <p className="text-slate-500 max-w-xs mx-auto mt-1.5 text-sm">
                                    This teacher has no classes in the selected timetable.
                                </p>
                            </div>
                        )}
                    </main>
                </>
            ) : (
                <div className="text-center py-24">
                    <h4 className="text-lg font-bold text-slate-800">Teacher Not Found</h4>
                </div>
            )}
        </div>
    );
}
