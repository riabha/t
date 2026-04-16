import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineLockClosed, HiOutlineCheckCircle, HiOutlineClock,
    HiOutlineSave, HiOutlineFilter, HiOutlineBan, HiOutlineFastForward,
    HiOutlineClipboardList, HiOutlineExclamationCircle, HiOutlineBeaker,
    HiOutlineInformationCircle
} from 'react-icons/hi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7]; // Max slots

export default function RestrictionsPage() {
    const { user } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [sections, setSections] = useState([]);

    // Filters
    const [selectedDept, setSelectedDept] = useState(user?.department_id || '');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState('');

    // State
    const [restrictions, setRestrictions] = useState([]);
    const [config, setConfig] = useState({ lab_morning_days: [], no_gaps: true });
    // Global config for strict_teacher_restrictions - null until loaded
    const [globalConfig, setGlobalConfig] = useState(null);
    const [summary, setSummary] = useState({ teachers: [], sections: [] });
    const [loading, setLoading] = useState(false);

    // Batch morning lab configuration state
    const [batchConfigs, setBatchConfigs] = useState({});
    const [editingBatch, setEditingBatch] = useState(null);
    const [savingBatch, setSavingBatch] = useState(null);

    // Initial load: Departments
    useEffect(() => {
        api.get('/departments/').then(res => {
            setDepartments(res.data);
            if (!selectedDept && res.data.length > 0 && user?.role === 'super_admin') {
                setSelectedDept(res.data[0].id);
            }
        }).catch(err => console.error("Failed to load departments:", err));
        api.get('/settings/').then(res => {
            setGlobalConfig(res.data);
        }).catch(err => {
            console.error("Failed to load global config:", err);
            // Don't set a partial object, let it remain null or at least a full default if possible
            // But since we have a loading check, keeping it null is safer until we have real data
        });
        loadSummary();
    }, [user]);

    // Load Teachers and Batches when Dept changes
    useEffect(() => {
        if (!selectedDept) return;
        const deptId = parseInt(selectedDept);

        // Load Teachers for this dept
        api.get('/teachers/', { params: { department_id: deptId } }).then(res => {
            setTeachers(res.data);
            setSelectedTeacher('');
            setRestrictions([]);
        });

        // Load Batches for this dept
        api.get('/departments/batches').then(res => {
            const filtered = res.data.filter(b => b.department_id === deptId);
            setBatches(filtered);
            setSelectedBatch('');
            setSelectedSection('');

            // Load batch morning lab configurations
            loadBatchConfigs(filtered);
        });

        loadSummary(deptId);
    }, [selectedDept]);

    // Load Sections when Batch changes
    useEffect(() => {
        if (!selectedBatch) {
            setSections([]);
            return;
        }
        api.get('/departments/sections').then(res => {
            const filtered = res.data.filter(s => s.batch_id === parseInt(selectedBatch));
            setSections(filtered);
            setSelectedSection('');
        });
    }, [selectedBatch]);

    // Load Config when Section changes
    useEffect(() => {
        if (!selectedSection) {
            setConfig({ lab_morning_days: [], no_gaps: true });
            return;
        }
        api.get(`/restrictions/config/${selectedSection}`).then(res => {
            setConfig(res.data);
        });
    }, [selectedSection]);

    const loadSummary = async (deptId = selectedDept) => {
        try {
            const res = await api.get('/restrictions/summary', { params: { department_id: deptId || undefined } });
            setSummary(res.data);
        } catch (err) { console.error("Failed to load summary", err); }
    };

    const loadTeacherRestrictions = async (tId) => {
        if (!tId) { setRestrictions([]); return; }
        setLoading(true);
        try {
            const res = await api.get(`/restrictions/teacher/${tId}`);
            setRestrictions(res.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const toggleRestriction = (day, slot) => {
        const exists = restrictions.find(r => r.day === day && r.slot_index === slot);
        if (exists) {
            setRestrictions(restrictions.filter(r => !(r.day === day && r.slot_index === slot)));
        } else {
            setRestrictions([...restrictions, { day, slot_index: slot }]);
        }
    };

    const blockDay = (dayIdx) => {
        const otherRes = restrictions.filter(r => r.day !== dayIdx);
        const dayRes = SLOTS.map(s => ({ day: dayIdx, slot_index: s }));
        setRestrictions([...otherRes, ...dayRes]);
    };

    const blockSlot = (slotIdx) => {
        const otherRes = restrictions.filter(r => r.slot_index !== slotIdx);
        const slotRes = DAYS.map((_, d) => ({ day: d, slot_index: slotIdx }));
        setRestrictions([...otherRes, ...slotRes]);
    };

    const clearAll = () => setRestrictions([]);

    const saveRestrictions = async () => {
        try {
            // Save restrictions
            await api.post(`/restrictions/teacher/${selectedTeacher}`,
                restrictions.map(r => ({ teacher_id: parseInt(selectedTeacher), day: r.day, slot_index: r.slot_index }))
            );

            // Save consecutive settings and restriction mode
            const teacher = teachers.find(t => t.id === parseInt(selectedTeacher));
            if (teacher) {
                await api.put(`/teachers/${selectedTeacher}`, {
                    name: teacher.name,
                    designation: teacher.designation,
                    max_contact_hours: teacher.max_contact_hours,
                    department_id: teacher.department_id,
                    is_lab_engineer: teacher.is_lab_engineer,
                    allow_consecutive: teacher.allow_consecutive,
                    max_consecutive_classes: teacher.max_consecutive_classes,
                    restriction_mode: teacher.restriction_mode || 'preferred'
                });
            }

            alert('Teacher availability saved successfully');
            loadSummary();
        } catch (err) { alert('Failed to save restrictions'); }
    };

    const handleConfigSave = async () => {
        try {
            await api.post('/restrictions/config', {
                ...config,
                section_id: parseInt(selectedSection)
            });
            alert('Section configuration saved');
            loadSummary();
        } catch (err) { alert('Failed to save config'); }
    };

    const toggleMorningLab = (dayIdx) => {
        const morningDays = [...config.lab_morning_days];
        if (morningDays.includes(dayIdx)) {
            setConfig({ ...config, lab_morning_days: morningDays.filter(d => d !== dayIdx) });
        } else {
            setConfig({ ...config, lab_morning_days: [...morningDays, dayIdx] });
        }
    };

    const toggleStrictMode = async () => {
        if (!['super_admin', 'program_admin'].includes(user?.role)) return;
        if (!globalConfig) return;

        const newValue = !globalConfig.strict_teacher_restrictions;
        const previousConfig = { ...globalConfig };

        // Optimistic update
        setGlobalConfig({ ...globalConfig, strict_teacher_restrictions: newValue });

        try {
            // Only send the field that changed to avoid side effects and 422s
            const res = await api.put('/settings/', { strict_teacher_restrictions: newValue });
            // Merge response to get full updated state
            setGlobalConfig(prev => ({ ...prev, ...res.data }));
        } catch (err) {
            console.error("Failed to update strict mode", err);
            setGlobalConfig(previousConfig); // Rollback
            alert("Failed to update strict mode. Please check if you have permissions.");
        }
    };

    // Batch morning lab configuration functions
    const loadBatchConfigs = async (batchList) => {
        const configs = {};
        for (const batch of batchList) {
            configs[batch.id] = {
                morning_lab_mode: batch.morning_lab_mode || null,
                morning_lab_count: batch.morning_lab_count || null,
                morning_lab_days: batch.morning_lab_days || []
            };
        }
        setBatchConfigs(configs);
    };

    const updateBatchConfig = (batchId, field, value) => {
        setBatchConfigs(prev => ({
            ...prev,
            [batchId]: {
                ...prev[batchId],
                [field]: value
            }
        }));
    };

    const saveBatchConfig = async (batchId) => {
        setSavingBatch(batchId);
        try {
            const batch = batches.find(b => b.id === batchId);
            const config = batchConfigs[batchId];

            await api.put(`/departments/batches/${batchId}`, {
                ...batch,
                morning_lab_mode: config.morning_lab_mode,
                morning_lab_count: config.morning_lab_count,
                morning_lab_days: config.morning_lab_days
            });

            alert('Batch morning lab configuration saved successfully');
            setEditingBatch(null);
        } catch (err) {
            alert('Failed to save batch configuration: ' + (err.response?.data?.detail || err.message));
        } finally {
            setSavingBatch(null);
        }
    };

    const toggleBatchMorningDay = (batchId, dayIdx) => {
        const config = batchConfigs[batchId] || { morning_lab_days: [] };
        const days = [...config.morning_lab_days];
        if (days.includes(dayIdx)) {
            updateBatchConfig(batchId, 'morning_lab_days', days.filter(d => d !== dayIdx));
        } else {
            updateBatchConfig(batchId, 'morning_lab_days', [...days, dayIdx]);
        }
    };

    const getModeColor = (mode) => {
        switch (mode) {
            case 'strict': return 'bg-green-100 text-green-700 border-green-200';
            case 'prefer': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'count': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-slate-100 text-slate-500 border-slate-200';
        }
    };

    const getModeLabel = (mode) => {
        switch (mode) {
            case 'strict': return 'All labs in morning (strict)';
            case 'prefer': return 'Prefer morning labs';
            case 'count': return 'Specific count';
            default: return 'No requirement';
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Scheduling Restrictions</h1>
                    <p className="text-sm text-slate-500">Define teacher availability and section-level constraints</p>
                </div>

                {/* Global Dept Filter (for Super Admins) */}
                {user?.role === 'super_admin' && (
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <HiOutlineFilter className="text-slate-400" />
                        <select
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                        >
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Teacher Availability */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <HiOutlineLockClosed className="w-5 h-5 text-red-500" />
                                <h2 className="font-bold text-slate-800">Teacher Availability</h2>
                            </div>
                            <select
                                value={selectedTeacher}
                                onChange={e => { setSelectedTeacher(e.target.value); loadTeacherRestrictions(e.target.value); }}
                                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400 min-w-[200px]"
                            >
                                <option value="">Select a teacher...</option>
                                {teachers.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} {t.restriction_mode === 'strict' ? '🔒' : '💡'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedTeacher ? (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-800">Restriction Mode for {teachers.find(t => t.id === parseInt(selectedTeacher))?.name}</span>
                                            {teachers.find(t => t.id === parseInt(selectedTeacher)) && (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${teachers.find(t => t.id === parseInt(selectedTeacher))?.restriction_mode === 'strict' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {teachers.find(t => t.id === parseInt(selectedTeacher))?.restriction_mode === 'strict' ? 'Strict' : 'Preferred'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                            {teachers.find(t => t.id === parseInt(selectedTeacher))?.restriction_mode === 'strict'
                                                ? "Blocks are ABSOLUTE. Solver will fail before scheduling here."
                                                : "Blocks are PREFERRED. Solver skips if possible, but may use with penalty."}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const teacher = teachers.find(t => t.id === parseInt(selectedTeacher));
                                            if (teacher) {
                                                const newMode = teacher.restriction_mode === 'strict' ? 'preferred' : 'strict';
                                                setTeachers(teachers.map(t =>
                                                    t.id === parseInt(selectedTeacher)
                                                        ? { ...t, restriction_mode: newMode }
                                                        : t
                                                ));
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${teachers.find(t => t.id === parseInt(selectedTeacher))?.restriction_mode === 'strict'
                                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {teachers.find(t => t.id === parseInt(selectedTeacher))?.restriction_mode === 'strict' ? '🔒 Switch to Preferred' : '💡 Switch to Strict'}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-2">
                                    <p className="text-slate-500">Mark slots where the teacher is <span className="text-red-500 font-bold">UNAVAILABLE</span>.</p>
                                    <button onClick={clearAll} className="text-primary-600 hover:underline font-medium">Clear All</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="p-2 bg-slate-50 text-[10px] uppercase text-slate-400 font-bold border border-slate-100">Day / Slot</th>
                                                {SLOTS.map(s => (
                                                    <th key={s} className="p-2 bg-slate-50 border border-slate-100 group relative">
                                                        <div className="text-[10px] font-bold">#{s + 1}</div>
                                                        <button
                                                            onClick={() => blockSlot(s)}
                                                            className="absolute -top-1 right-0 hidden group-hover:flex w-4 h-4 bg-red-100 text-red-600 rounded-full items-center justify-center"
                                                            title="Block this time for all days"
                                                        >
                                                            <HiOutlineBan className="w-3 h-3" />
                                                        </button>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {DAYS.map((day, dIdx) => (
                                                <tr key={day} className="group">
                                                    <td className="p-2 text-xs font-bold text-slate-600 bg-slate-50/50 border border-slate-100 flex items-center justify-between">
                                                        {day}
                                                        <button
                                                            onClick={() => blockDay(dIdx)}
                                                            className="hidden group-hover:flex text-red-400 hover:text-red-600"
                                                            title="Block entire day"
                                                        >
                                                            <HiOutlineBan className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                    {SLOTS.map(sIdx => {
                                                        const isBlocked = restrictions.some(r => r.day === dIdx && r.slot_index === sIdx);
                                                        return (
                                                            <td key={sIdx} className="p-1 border border-slate-100 text-center">
                                                                <button
                                                                    onClick={() => toggleRestriction(dIdx, sIdx)}
                                                                    className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${isBlocked ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                                                        }`}
                                                                >
                                                                    {isBlocked ? <HiOutlineClock className="w-4 h-4" /> : <HiOutlineCheckCircle className="w-4 h-4" />}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Consecutive Classes Settings */}
                                <div className="pt-4 border-t border-slate-200 space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">Allow Consecutive Classes</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Same batch, back-to-back slots</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const teacher = teachers.find(t => t.id === parseInt(selectedTeacher));
                                                if (teacher) {
                                                    const newValue = !teacher.allow_consecutive;
                                                    setTeachers(teachers.map(t =>
                                                        t.id === parseInt(selectedTeacher)
                                                            ? { ...t, allow_consecutive: newValue }
                                                            : t
                                                    ));
                                                }
                                            }}
                                            className={`w-12 h-6 rounded-full transition-all relative ${teachers.find(t => t.id === parseInt(selectedTeacher))?.allow_consecutive
                                                ? 'bg-primary-500'
                                                : 'bg-slate-200'
                                                }`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${teachers.find(t => t.id === parseInt(selectedTeacher))?.allow_consecutive
                                                ? 'right-1'
                                                : 'left-1'
                                                }`}></div>
                                        </button>
                                    </div>

                                    {teachers.find(t => t.id === parseInt(selectedTeacher))?.allow_consecutive && (
                                        <div className="space-y-2 animate-in slide-in-from-right duration-300">
                                            <label className="text-xs font-bold text-slate-700 ml-1">Max Consecutive Classes</label>
                                            <select
                                                value={teachers.find(t => t.id === parseInt(selectedTeacher))?.max_consecutive_classes || 2}
                                                onChange={e => {
                                                    const newValue = parseInt(e.target.value);
                                                    setTeachers(teachers.map(t =>
                                                        t.id === parseInt(selectedTeacher)
                                                            ? { ...t, max_consecutive_classes: newValue }
                                                            : t
                                                    ));
                                                }}
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                            >
                                                <option value="2">2 consecutive slots</option>
                                                <option value="3">3 consecutive slots</option>
                                                <option value="4">4 consecutive slots</option>
                                                <option value="5">5 consecutive slots</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={saveRestrictions}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-all shadow-lg shadow-slate-200"
                                    >
                                        <HiOutlineSave className="w-4 h-4" /> Save Availability
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-slate-400 text-sm">Select a teacher to manage their availability grid</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Section-Level Logic */}
                <div className="space-y-6">
                    <div className="glass p-6 space-y-6">
                        <div className="flex items-center gap-2">
                            <HiOutlineFastForward className="w-5 h-5 text-primary-500" />
                            <h2 className="font-bold text-slate-800">Section Logic</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 ml-1">1. Select Section</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={selectedBatch}
                                        onChange={e => setSelectedBatch(e.target.value)}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                                    >
                                        <option value="">Batch</option>
                                        {batches.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                                    </select>
                                    <select
                                        value={selectedSection}
                                        onChange={e => setSelectedSection(e.target.value)}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                                        disabled={!selectedBatch}
                                    >
                                        <option value="">Section</option>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {selectedSection ? (
                                <div className="space-y-6 pt-2 animate-in slide-in-from-right duration-300">
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">No Gaps Policy</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Continuous classes from morning</div>
                                        </div>
                                        <button
                                            onClick={() => setConfig({ ...config, no_gaps: !config.no_gaps })}
                                            className={`w-12 h-6 rounded-full transition-all relative ${config.no_gaps ? 'bg-primary-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.no_gaps ? 'right-1' : 'left-1'}`}></div>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                            <HiOutlineInformationCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                            <div className="text-[10px] text-amber-800">
                                                <p className="font-bold mb-1">Deprecated: Per-section morning lab configuration</p>
                                                <p>Morning lab configuration has moved to batch-level settings below. This section is kept for backward compatibility only.</p>
                                            </div>
                                        </div>
                                        <label className="text-xs font-bold text-slate-400 ml-1 line-through">Morning Labs (Deprecated)</label>
                                        <p className="text-[10px] text-slate-400 ml-1 mb-2 italic">Force labs to 8:30 AM on these days:</p>
                                        <div className="grid grid-cols-1 gap-2 opacity-50 pointer-events-none">
                                            {DAYS.map((day, idx) => (
                                                <button
                                                    key={day}
                                                    disabled
                                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${config.lab_morning_days.includes(idx)
                                                        ? 'bg-primary-50 border-primary-200 text-primary-700'
                                                        : 'bg-white border-slate-100 text-slate-500'
                                                        }`}
                                                >
                                                    {day}
                                                    {config.lab_morning_days.includes(idx) && <HiOutlineCheckCircle className="w-4 h-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleConfigSave}
                                        className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all"
                                    >
                                        Save Section Config
                                    </button>
                                </div>
                            ) : (
                                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 mt-4">
                                    <p className="text-slate-400 text-[10px] font-medium leading-relaxed">
                                        Select a specific batch and section to customize its scheduling policy.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-[10px] text-amber-800 leading-relaxed shadow-sm">
                        <p className="font-bold mb-1">💡 Scheduling Tip:</p>
                        "No Gaps" is the strictest policy. If generation fails, try disabling it for sections with very complex combinations or many restricted teachers.
                    </div>

                    {/* Column 3: Summary Sidebar */}
                    <div className="glass p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <HiOutlineClipboardList className="w-5 h-5 text-indigo-500" />
                            <h2 className="font-bold text-slate-800">Active Constraints</h2>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {/* Teachers Summary */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <HiOutlineLockClosed className="w-3 h-3" /> Restricted Teachers
                                </div>
                                {summary.teachers.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {summary.teachers.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => { setSelectedTeacher(t.id); loadTeacherRestrictions(t.id); }}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-medium border flex items-center gap-1.5 transition-all ${selectedTeacher == t.id
                                                    ? 'bg-red-500 border-red-600 text-white shadow-sm'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50'
                                                    }`}
                                            >
                                                {t.name}
                                                <span className={`px-1 rounded-sm ${selectedTeacher == t.id ? 'bg-red-600/50' : 'bg-red-100 text-red-600'}`}>{t.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic py-2">No restricted teachers</p>
                                )}
                            </div>

                            {/* Sections Summary */}
                            <div className="space-y-2 pt-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <HiOutlineExclamationCircle className="w-3 h-3 text-amber-500" /> Section Logic
                                </div>
                                {summary.sections.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {summary.sections.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    // This is nested state (batch -> section), might need to find batch first
                                                    // For now just select section if it exists in current batch list
                                                    setSelectedSection(s.id);
                                                }}
                                                className={`w-full text-left p-2 rounded-xl border transition-all ${selectedSection == s.id
                                                    ? 'bg-amber-50 border-amber-200 shadow-sm'
                                                    : 'bg-white border-slate-100 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="text-[10px] font-bold text-slate-800">{s.name}</div>
                                                <div className="text-[9px] text-slate-500 truncate">{s.reason}</div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic py-2">All sections using defaults</p>
                                )}
                            </div>
                        </div>

                        {(summary.teachers.length > 0 || summary.sections.length > 0) && (
                            <div className="pt-2">
                                <p className="text-[9px] text-slate-400 leading-tight">
                                    * Click any item above to quickly select and edit it.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Batch Lab Scheduling Section */}
            <div className="glass p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <HiOutlineBeaker className="w-6 h-6 text-indigo-600" />
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Batch Lab Scheduling</h2>
                        <p className="text-xs text-slate-500">Configure morning lab requirements at the batch level</p>
                    </div>
                </div>

                {batches.length > 0 ? (
                    <div className="space-y-4">
                        {batches.map(batch => {
                            const config = batchConfigs[batch.id] || {};
                            const isEditing = editingBatch === batch.id;
                            const isSaving = savingBatch === batch.id;

                            return (
                                <div key={batch.id} className="border border-slate-200 rounded-xl p-4 space-y-3 hover:border-slate-300 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-slate-800">{batch.display_name}</h3>
                                            {config.morning_lab_mode && (
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getModeColor(config.morning_lab_mode)}`}
                                                    title={`Mode: ${getModeLabel(config.morning_lab_mode)}`}>
                                                    {config.morning_lab_mode === 'strict' && '🌅 Strict'}
                                                    {config.morning_lab_mode === 'prefer' && '☀️ Prefer'}
                                                    {config.morning_lab_mode === 'count' && `📊 ${config.morning_lab_count || 0} labs`}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setEditingBatch(isEditing ? null : batch.id)}
                                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                            {isEditing ? 'Cancel' : 'Configure'}
                                        </button>
                                    </div>

                                    {isEditing && (
                                        <div className="space-y-4 pt-3 border-t border-slate-100 animate-in slide-in-from-top duration-300">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-700 ml-1">Morning Lab Mode</label>
                                                <select
                                                    value={config.morning_lab_mode || ''}
                                                    onChange={e => updateBatchConfig(batch.id, 'morning_lab_mode', e.target.value || null)}
                                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                                >
                                                    <option value="">No requirement</option>
                                                    <option value="strict">All labs in morning (strict)</option>
                                                    <option value="prefer">Prefer morning labs</option>
                                                    <option value="count">Specific count</option>
                                                </select>
                                            </div>

                                            {config.morning_lab_mode === 'count' && (
                                                <div className="space-y-2 animate-in slide-in-from-top duration-200">
                                                    <label className="text-xs font-bold text-slate-700 ml-1">Number of Morning Labs Required</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={config.morning_lab_count || ''}
                                                        onChange={e => updateBatchConfig(batch.id, 'morning_lab_count', parseInt(e.target.value) || null)}
                                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                                        placeholder="e.g., 2"
                                                    />
                                                </div>
                                            )}

                                            {config.morning_lab_mode && (
                                                <div className="space-y-2 animate-in slide-in-from-top duration-200">
                                                    <label className="text-xs font-bold text-slate-700 ml-1">Morning Lab Days (optional, defaults to all days)</label>
                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                                        {DAYS.map((day, idx) => (
                                                            <button
                                                                key={day}
                                                                onClick={() => toggleBatchMorningDay(batch.id, idx)}
                                                                className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${config.morning_lab_days?.includes(idx)
                                                                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                                    }`}
                                                            >
                                                                {day.substring(0, 3)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 ml-1 italic">
                                                        Leave empty to apply to all days
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    onClick={() => saveBatchConfig(batch.id)}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-all disabled:opacity-50"
                                                >
                                                    <HiOutlineSave className="w-4 h-4" />
                                                    {isSaving ? 'Saving...' : 'Save Configuration'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!isEditing && config.morning_lab_mode && (
                                        <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                                            <p className="font-medium">Current Configuration:</p>
                                            <p className="text-slate-500">
                                                Mode: {getModeLabel(config.morning_lab_mode)}
                                                {config.morning_lab_mode === 'count' && ` (${config.morning_lab_count || 0} labs)`}
                                            </p>
                                            {config.morning_lab_days?.length > 0 && (
                                                <p className="text-slate-500">
                                                    Days: {config.morning_lab_days.map(d => DAYS[d]).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm">No batches available. Select a department to view batches.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
