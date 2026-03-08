import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlineAdjustments, HiOutlineSave, HiOutlineClock, HiOutlineExclamationCircle, HiOutlineBeaker, HiOutlineX, HiOutlineLockClosed } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
    const { user } = useAuth();
    const [config, setConfig] = useState({
        max_slots_per_day: 8,
        max_slots_friday: 5,
        break_slot: 2,
        break_start_time: "10:30",
        break_end_time: "11:00",
        gap_penalty: 5000000,
        workload_penalty: 2000000,
        early_slot_penalty: 10,
        lab_priority_multiplier: 50,
        solver_timeout: 60,
        fyp_rules: [],
        lab_rules: [],
        compact_morning: false,
        friday_has_break: false,
        allow_morning_labs: false,
        strict_teacher_restrictions: false
    });
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Password Change State
    const [passwordForm, setPasswordForm] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [passwordChanging, setPasswordChanging] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState(null);

    // Rule Builder State
    const [newRule, setNewRule] = useState({ dept: '', batch: '', day: 4, label: 'FYP-II', start_slot: 0, consecutive_slots: 5 });
    const [newLabRule, setNewLabRule] = useState({ dept: '', batch: '', morning_days: [0, 1], preferred_start_slot: 0, strict_mode: false });

    const isSuper = user?.role === 'super_admin';
    const isProgramAdmin = user?.role === 'program_admin';

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            const [setts, depts] = await Promise.all([
                api.get('/settings/'),
                api.get('/departments/')
            ]);
            setConfig(setts.data);
            setDepartments(depts.data);

            // Auto-set dept for program admin
            if (isProgramAdmin) {
                const myDept = depts.data.find(d => d.id === user?.department_id);
                if (myDept) {
                    setNewRule(prev => ({ ...prev, dept: myDept.code }));
                    setNewLabRule(prev => ({ ...prev, dept: myDept.code }));
                }
            }
        } catch (e) {
            console.error('Failed to load settings', e);
            setMessage({ type: 'error', text: 'Failed to connect to configuration server.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/settings/', config);
            setMessage({ type: 'success', text: 'Global settings updated successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
            setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to update settings' });
        } finally {
            setSaving(false);
        }
    };

    const addRule = () => {
        if (!newRule.dept && !newRule.batch) return alert('Specify at least a Department or Batch');
        setConfig(prev => ({
            ...prev,
            fyp_rules: [...(prev.fyp_rules || []), { ...newRule, batch: newRule.batch ? parseInt(newRule.batch) : '' }]
        }));
        setNewRule({ dept: '', batch: '', day: 4, label: 'FYP-II', start_slot: 0, consecutive_slots: 5 });
    };

    const removeRule = (index) => {
        setConfig(prev => ({
            ...prev,
            fyp_rules: prev.fyp_rules.filter((_, i) => i !== index)
        }));
    };

    const addLabRule = () => {
        if (!newLabRule.dept && !newLabRule.batch) return alert('Specify Dept or Batch');
        setConfig(prev => ({
            ...prev,
            lab_rules: [...(prev.lab_rules || []), { ...newLabRule, batch: newLabRule.batch ? parseInt(newLabRule.batch) : '' }]
        }));
        setNewLabRule({ dept: '', batch: '', morning_days: [0, 1], preferred_start_slot: 0, strict_mode: false });
    };

    const removeLabRule = (index) => {
        setConfig(prev => ({
            ...prev,
            lab_rules: prev.lab_rules.filter((_, i) => i !== index)
        }));
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (passwordForm.new_password.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setPasswordChanging(true);
        try {
            await api.post('/users/change-password', {
                old_password: passwordForm.old_password,
                new_password: passwordForm.new_password
            });
            setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
            setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
            setTimeout(() => setPasswordMessage(null), 3000);
        } catch (e) {
            setPasswordMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to change password' });
        } finally {
            setPasswordChanging(false);
        }
    };

    if (!isSuper && !isProgramAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-20 glass text-center">
                <HiOutlineExclamationCircle className="w-16 h-16 text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold text-slate-800">Access Denied</h1>
                <p className="text-slate-500">Only administrators can access this page.</p>
            </div>
        );
    }

    if (loading) return <div className="p-10 text-center text-slate-400">Loading configurations...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Settings & Configuration</h1>
                    <p className="text-slate-500 text-sm">Manage your account and system settings</p>
                </div>
            </header>

            {/* Password Change Section - Available to All Users */}
            <section className="glass p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <HiOutlineLockClosed className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Change Password</h2>
                </div>

                {passwordMessage && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200 ${passwordMessage.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border border-rose-200 text-rose-700'
                        }`}>
                        <HiOutlineExclamationCircle className="w-5 h-5" />
                        <span className="text-sm font-bold">{passwordMessage.text}</span>
                    </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 ml-1">Current Password</label>
                            <input
                                type="password"
                                required
                                value={passwordForm.old_password}
                                onChange={e => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 ml-1">New Password</label>
                            <input
                                type="password"
                                required
                                value={passwordForm.new_password}
                                onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 ml-1">Confirm New Password</label>
                            <input
                                type="password"
                                required
                                value={passwordForm.confirm_password}
                                onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
                                placeholder="••••••••"
                            />
                        </div>

                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={passwordChanging}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {passwordChanging ? 'Changing...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </section>

            {/* Admin Settings - Only for Super Admin and Program Admin */}
            {(isSuper || isProgramAdmin) && (
                <>
                    <div className="border-t border-slate-200 pt-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Advanced Solver Settings</h2>
                                <p className="text-slate-500 text-sm">Fine-tune the core constraints and algorithmic weights</p>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95 transition-all disabled:opacity-50"
                            >
                                <HiOutlineSave className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in-95 duration-200 mb-6 ${message.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                                }`}>
                                <HiOutlineExclamationCircle className="w-5 h-5" />
                                <span className="text-sm font-bold">{message.text}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Time Grid Config */}
                        <section className="glass p-6 space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                    <HiOutlineClock className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Time Grid Definition</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Max Slots (Mon-Thu)</label>
                                    <input
                                        type="number"
                                        disabled={!isSuper}
                                        value={config.max_slots_per_day}
                                        onChange={e => setConfig({ ...config, max_slots_per_day: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Max Slots (Friday)</label>
                                    <input
                                        type="number"
                                        disabled={!isSuper}
                                        value={config.max_slots_friday}
                                        onChange={e => setConfig({ ...config, max_slots_friday: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Break Slot Index</label>
                                        <input
                                            type="number"
                                            disabled={!isSuper}
                                            value={config.break_slot}
                                            onChange={e => setConfig({ ...config, break_slot: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="col-span-2 grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start</label>
                                            <input
                                                type="text"
                                                disabled={!isSuper}
                                                value={config.break_start_time}
                                                onChange={e => setConfig({ ...config, break_start_time: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm disabled:opacity-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">End</label>
                                            <input
                                                type="text"
                                                disabled={!isSuper}
                                                value={config.break_end_time}
                                                onChange={e => setConfig({ ...config, break_end_time: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <input
                                        type="checkbox"
                                        id="fridayBreak"
                                        disabled={!isSuper}
                                        checked={config.friday_has_break}
                                        onChange={e => setConfig({ ...config, friday_has_break: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor="fridayBreak" className="text-xs font-bold text-slate-600 uppercase tracking-tight cursor-pointer">
                                        Enable Break Slot on Friday
                                    </label>
                                </div>
                            </div>
                        </section>

                        {/* Algorithmic Weights */}
                        <section className="glass p-6 space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                                    <HiOutlineBeaker className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Solver Weights (Penalties)</h2>
                            </div>

                            <div className="space-y-6">
                                <PenaltyControl
                                    label="Student Gaps Importance"
                                    description="Higher value makes the solver work much harder to eliminate holes in student timetables."
                                    value={config.gap_penalty}
                                    onChange={v => setConfig({ ...config, gap_penalty: v })}
                                    max={10000000}
                                    step={100000}
                                    disabled={!isSuper}
                                />
                                <PenaltyControl
                                    label="Workload Compliance"
                                    description="Priority of staying within teacher's max contact hours vs scheduling more classes."
                                    value={config.workload_penalty}
                                    onChange={v => setConfig({ ...config, workload_penalty: v })}
                                    max={5000000}
                                    step={100000}
                                    disabled={!isSuper}
                                />
                                <PenaltyControl
                                    label="Morning Preference"
                                    description="Bias towards filling early slots first. Higher value makes 3:00 PM classes very rare."
                                    value={config.early_slot_penalty}
                                    onChange={v => setConfig({ ...config, early_slot_penalty: v })}
                                    max={100}
                                    step={5}
                                    disabled={!isSuper}
                                />
                                <PenaltyControl
                                    label="Lab Slot Priority"
                                    description="Multiplier for lab placement. Higher value pushes labs to the earliest possible open morning slots."
                                    value={config.lab_priority_multiplier}
                                    onChange={v => setConfig({ ...config, lab_priority_multiplier: v })}
                                    max={200}
                                    step={10}
                                    disabled={!isSuper}
                                />
                            </div>
                        </section>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Performance Tuning */}
                        <section className="glass p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                    <HiOutlineBeaker className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-800">Solver Intensity</h2>
                            </div>
                            <PenaltyControl
                                label="Computational Budget (Seconds)"
                                description="Max time (seconds) the solver can spend finding the mathematical optimum. Increase for dense schedules."
                                value={config.solver_timeout}
                                onChange={v => setConfig({ ...config, solver_timeout: v })}
                                max={300}
                                step={10}
                                disabled={!isSuper}
                            />

                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Compact Morning Schedule</span>
                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight max-w-xs">
                                            Force all classes to start from the first morning slot and be continuous — no empty gaps before filled slots.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setConfig({ ...config, compact_morning: !config.compact_morning })}
                                        disabled={!isSuper}
                                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${config.compact_morning ? 'bg-indigo-600' : 'bg-slate-200'
                                            }`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${config.compact_morning ? 'translate-x-6' : 'translate-x-0'
                                            }`} />
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Flexible Scheduling Rules */}
                    <section className="glass p-6 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <HiOutlineAdjustments className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Batch Restrictions (FYP, Events)</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newRule.dept}
                                    disabled={isProgramAdmin}
                                    onChange={e => setNewRule({ ...newRule, dept: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs disabled:opacity-80"
                                >
                                    <option value="">Select Dept (Optional)</option>
                                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                                </select>
                                <input
                                    type="number" placeholder="Batch Year (e.g. 22)"
                                    value={newRule.batch}
                                    onChange={e => setNewRule({ ...newRule, batch: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <select
                                    value={newRule.day}
                                    onChange={e => setNewRule({ ...newRule, day: parseInt(e.target.value) })}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs col-span-1"
                                >
                                    <option value={0}>Monday</option>
                                    <option value={1}>Tuesday</option>
                                    <option value={2}>Wednesday</option>
                                    <option value={3}>Thursday</option>
                                    <option value={4}>Friday</option>
                                </select>
                                <input
                                    type="text" placeholder="Label (e.g. FYP-II)"
                                    value={newRule.label}
                                    onChange={e => setNewRule({ ...newRule, label: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs col-span-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Slot</label>
                                    <select
                                        value={newRule.start_slot || 0}
                                        onChange={e => setNewRule({ ...newRule, start_slot: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                    >
                                        <option value={0}>Slot 1</option>
                                        <option value={1}>Slot 2</option>
                                        <option value={2}>Slot 3</option>
                                        <option value={3}>Slot 4</option>
                                        <option value={4}>Slot 5</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Consecutive Slots</label>
                                    <select
                                        value={newRule.consecutive_slots || 5}
                                        onChange={e => setNewRule({ ...newRule, consecutive_slots: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                    >
                                        <option value={3}>3 Slots</option>
                                        <option value={4}>4 Slots</option>
                                        <option value={5}>5 Slots</option>
                                        <option value={6}>6 Slots</option>
                                        <option value={7}>7 Slots</option>
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={addRule}
                                className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all"
                            >
                                + Add Restriction Rule
                            </button>

                            <div className="space-y-2 mt-4 max-h-48 overflow-y-auto custom-scrollbar">
                                {(config.fyp_rules || [])
                                    .filter(rule => isSuper || rule.dept === (departments.find(d => d.id === user?.department_id)?.code))
                                    .map((rule, idx) => {
                                        // Map original index back for removal
                                        const originalIdx = config.fyp_rules.indexOf(rule);
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex flex-col flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase">
                                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][rule.day] || 'Day'}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {rule.dept || 'All Depts'} {rule.batch ? `'${rule.batch}` : ''}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 mt-0.5 tracking-tight uppercase font-medium">{rule.label}</span>
                                                    {(rule.start_slot !== undefined || rule.consecutive_slots !== undefined) && (
                                                        <span className="text-[9px] text-indigo-600 mt-1 font-medium">
                                                            Slot {(rule.start_slot || 0) + 1} → {rule.consecutive_slots || 5} consecutive slots
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeRule(originalIdx)}
                                                    className="text-rose-400 hover:text-rose-600 p-1"
                                                >
                                                    <HiOutlineX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </section>

                    {/* Lab Timing Manager */}
                    <section className="glass p-6 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <HiOutlineClock className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">Lab Timing Manager</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newLabRule.dept}
                                    disabled={isProgramAdmin}
                                    onChange={e => setNewLabRule({ ...newLabRule, dept: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs disabled:opacity-80"
                                >
                                    <option value="">Select Dept (Optional)</option>
                                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                                </select>
                                <input
                                    type="number" placeholder="Batch (e.g. 22)"
                                    value={newLabRule.batch}
                                    onChange={e => setNewLabRule({ ...newLabRule, batch: e.target.value })}
                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {['M', 'T', 'W', 'Th', 'F'].map((day, dIdx) => (
                                    <button
                                        key={day}
                                        onClick={() => {
                                            const current = newLabRule.morning_days || [];
                                            const next = current.includes(dIdx)
                                                ? current.filter(d => d !== dIdx)
                                                : [...current, dIdx];
                                            setNewLabRule({ ...newLabRule, morning_days: next });
                                        }}
                                        className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${(newLabRule.morning_days || []).includes(dIdx)
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                                <span className="text-[10px] text-slate-400 ml-1 self-center italic">Preferred Morning Days</span>
                            </div>

                            <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="strictMode"
                                        checked={newLabRule.strict_mode || false}
                                        onChange={e => setNewLabRule({ ...newLabRule, strict_mode: e.target.checked })}
                                        className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                                    />
                                    <label htmlFor="strictMode" className="text-xs font-bold text-amber-800 cursor-pointer">
                                        Strict Lab Timing Mode
                                    </label>
                                </div>
                                <p className="text-[10px] text-amber-700 leading-tight">
                                    When enabled: Labs MUST start at the preferred slot, take 3 consecutive slots, followed by break, then theory classes start after break.
                                </p>

                                {newLabRule.strict_mode && (
                                    <div>
                                        <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">
                                            Preferred Lab Start Slot
                                        </label>
                                        <select
                                            value={newLabRule.preferred_start_slot || 0}
                                            onChange={e => setNewLabRule({ ...newLabRule, preferred_start_slot: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs"
                                        >
                                            <option value={0}>Slot 1</option>
                                            <option value={1}>Slot 2</option>
                                            <option value={2}>Slot 3</option>
                                            <option value={3}>Slot 4</option>
                                            <option value={4}>Slot 5</option>
                                        </select>
                                        <p className="text-[9px] text-amber-600 mt-1 italic">
                                            Example: Slot 1 → Lab (Slots 1-3) → Break (Slot 4) → Theory (Slot 5+)
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={addLabRule}
                                className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-all"
                            >
                                + Add Lab Preference
                            </button>

                            <div className="space-y-2 mt-4 max-h-48 overflow-y-auto custom-scrollbar">
                                {(config.lab_rules || [])
                                    .filter(rule => isSuper || rule.dept === (departments.find(d => d.id === user?.department_id)?.code))
                                    .map((rule, idx) => {
                                        const originalIdx = config.lab_rules.indexOf(rule);
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                                <div className="flex flex-col flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {rule.dept || 'All Depts'} {rule.batch ? `'${rule.batch}` : ''}
                                                        </span>
                                                        {rule.strict_mode && (
                                                            <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">
                                                                Strict
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 mt-1">
                                                        {[0, 1, 2, 3, 4].map(d => (
                                                            <span key={d} className={`text-[8px] font-black px-1 rounded ${(rule.morning_days || []).includes(d)
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-slate-200 text-slate-400 opacity-50'
                                                                }`}>
                                                                {['M', 'T', 'W', 'Th', 'F'][d]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {rule.strict_mode && rule.preferred_start_slot !== undefined && (
                                                        <span className="text-[9px] text-amber-600 mt-1 font-medium">
                                                            Lab Start: Slot {rule.preferred_start_slot + 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeLabRule(originalIdx)}
                                                    className="text-rose-400 hover:text-rose-600 p-1"
                                                >
                                                    <HiOutlineX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </section>

                    {/* Bottom Save Button */}
                    <div className="sticky bottom-4 flex justify-center">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <HiOutlineSave className="w-5 h-5" />
                            {saving ? 'Saving Configuration...' : 'Save Configuration'}
                        </button>
                    </div>
                </>
            )
            }
        </div >
    );
}

function PenaltyControl({ label, description, value, onChange, max, step, disabled }) {
    return (
        <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{label}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                    {value.toLocaleString()}
                </span>
            </div>
            <input
                type="range"
                min="0"
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>
    );
}
