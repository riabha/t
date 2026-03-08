import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload, HiOutlineX, HiOutlineSelector } from 'react-icons/hi';

export default function TeachersPage() {
    const { user } = useAuth();
    const canCombine = ['super_admin', 'program_admin'].includes(user?.role);
    const [teachers, setTeachers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [viewDeptId, setViewDeptId] = useState(user?.department_id || '');
    const [form, setForm] = useState({
        name: '',
        designation: 'Lecturer',
        seniority: '',
        max_contact_hours: 12,
        is_lab_engineer: false,
        department_id: user?.department_id || '',
        assign_account: true,
        username: '',
        password: ''
    });
    const [showForm, setShowForm] = useState(false);

    const [selectedDept, setSelectedDept] = useState('');
    const [depts, setDepts] = useState([]);
    const [showEngageModal, setShowEngageModal] = useState(false);
    const [otherTeachers, setOtherTeachers] = useState([]);

    // Assignment View
    const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
    const [activeTeacher, setActiveTeacher] = useState(null);
    const [teacherAssignments, setTeacherAssignments] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState('');
    const [modalSessions, setModalSessions] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [modalDepartmentFilter, setModalDepartmentFilter] = useState(''); // '' = All Departments

    const designationHours = { 'Professor': 6, 'Associate Professor': 9, 'Assistant Professor': 12, 'Lecturer': 12, 'Lab Engineer': 15, 'Jr. Lab Engineer': 18 };

    useEffect(() => {
        loadTeachers(viewDeptId, null); // Don't filter by session for workload calculation
        api.get('/departments/').then(res => setDepts(res.data));
        api.get('/assignments/sessions').then(res => {
            setSessions(res.data);
            // Don't auto-select a session - let it default to showing all
        });
    }, [viewDeptId]);

    const loadTeachers = async (deptId, sessId) => {
        const params = {};
        if (deptId) params.department_id = deptId;
        if (sessId) params.session_id = sessId;
        const res = await api.get('/teachers/', { params });
        setTeachers(res.data);
    };

    const [selectedTeachersToEngage, setSelectedTeachersToEngage] = useState([]);
    const [selectedDepartments, setSelectedDepartments] = useState([]);

    const loadOtherTeachers = async (deptIds) => {
        if (!deptIds || deptIds.length === 0) {
            setOtherTeachers([]);
            return;
        }
        try {
            const allTeachers = [];
            for (const deptId of deptIds) {
                const res = await api.get('/teachers/', { params: { department_id: deptId } });
                allTeachers.push(...res.data);
            }
            const currentIds = teachers.map(t => t.id);
            const others = allTeachers.filter(t => !currentIds.includes(t.id));
            setOtherTeachers(others);
        } catch (e) {
            console.error('Failed to load other teachers', e);
        }
    };

    const handleEngageMultiple = async () => {
        if (selectedTeachersToEngage.length === 0) {
            alert('Please select at least one teacher to engage');
            return;
        }
        try {
            for (const teacherId of selectedTeachersToEngage) {
                await api.post(`/teachers/${teacherId}/engage`);
            }
            setShowEngageModal(false);
            setOtherTeachers([]);
            setSelectedDepartments([]);
            setSelectedTeachersToEngage([]);
            loadTeachers(viewDeptId);
        } catch (e) { alert(e.response?.data?.detail || 'Error engaging teachers'); }
    };

    const toggleDepartment = (deptId) => {
        const newSelected = selectedDepartments.includes(deptId)
            ? selectedDepartments.filter(id => id !== deptId)
            : [...selectedDepartments, deptId];
        setSelectedDepartments(newSelected);
        loadOtherTeachers(newSelected);
    };

    const toggleTeacher = (teacherId) => {
        setSelectedTeachersToEngage(prev =>
            prev.includes(teacherId)
                ? prev.filter(id => id !== teacherId)
                : [...prev, teacherId]
        );
    };

    const handleUnengage = async (teacher) => {
        if (!confirm(`Unengage ${teacher.name}? This teacher will no longer appear in your list.`)) return;
        try {
            await api.post(`/teachers/${teacher.id}/unengage`);
            loadTeachers(viewDeptId);
        } catch (e) { alert(e.response?.data?.detail || 'Error unengaging teacher'); }
    };

    const handleViewAssignments = async (teacher) => {
        setActiveTeacher(teacher);
        try {
            // Load ALL assignments for this teacher across ALL sessions/departments
            const res = await api.get('/assignments/', {
                params: { teacher_id: teacher.id }
            });
            const allAssignments = res.data;

            // Get ALL assignments (show complete cross-department schedule)
            const assignments = allAssignments.filter(a => a.session_id !== null);
            setTeacherAssignments(assignments);

            // Fetch session names for display - only show Latest and Previous
            const sessionsRes = await api.get('/assignments/sessions', { params: { show_archived: true } });
            const allSessions = sessionsRes.data.sort((a, b) => b.id - a.id); // Sort by ID descending (latest first)
            
            // Get only Latest and Previous sessions
            const latestAndPrevious = allSessions.slice(0, 2);
            setModalSessions(latestAndPrevious);
            setActiveSessionId(''); // Show all sessions by default

            setShowAssignmentsModal(true);
        } catch (e) {
            console.error('Error loading assignments:', e);
            alert('Failed to load assignments');
        }
    };

    const handleCombineFromProfile = async (asgn1, asgn2) => {
        try {
            await api.post('/assignments/merge', null, {
                params: { assignment_id: asgn1.id, target_assignment_id: asgn2.id }
            });
            handleViewAssignments(activeTeacher);
        } catch (e) { alert(e.response?.data?.detail || 'Merge failed'); }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTeachers = [...teachers].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'string') {
            const comp = aVal.localeCompare(bVal);
            return sortConfig.direction === 'asc' ? comp : -comp;
        }
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const handleDesignationChange = (d) => {
        setForm(f => ({ ...f, designation: d, max_contact_hours: designationHours[d] || 12 }));
    };

    const getBaseName = (name) => {
        const parts = name.trim().split(/\s+/);
        const salutations = ["prof", "dr", "engr", "mr", "ms", "mrs"];
        for (const p of parts) {
            if (!salutations.includes(p.replace(/\./g, "").toLowerCase())) {
                return p;
            }
        }
        return parts[0] || "";
    };

    const handleNameChange = (name) => {
        setForm(f => {
            const next = { ...f, name };
            if (f.assign_account && !editing) {
                const base = getBaseName(name).toLowerCase();
                next.username = base;
                next.password = base;
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form };

            // Handle numeric/nullable fields robustly
            const dId = parseInt(payload.department_id);
            payload.department_id = !isNaN(dId) ? dId : (user?.department_id || null);

            const sNr = parseInt(payload.seniority);
            payload.seniority = isNaN(sNr) ? null : sNr;

            const mHr = parseInt(payload.max_contact_hours);
            payload.max_contact_hours = !isNaN(mHr) ? mHr : 12;

            if (!payload.department_id) {
                alert('Please select a department first.');
                return;
            }
            if (editing) {
                await api.put(`/teachers/${editing}`, payload);
            } else {
                await api.post('/teachers/', payload);
            }
            loadTeachers(viewDeptId);
            resetForm();
        } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this teacher?')) return;
        await api.delete(`/teachers/${id}`);
        loadTeachers(viewDeptId);
    };

    const startEdit = (t) => {
        setEditing(t.id);
        setForm({
            name: t.name,
            designation: t.designation,
            seniority: t.seniority || '',
            max_contact_hours: t.max_contact_hours,
            is_lab_engineer: t.is_lab_engineer,
            department_id: t.department_id || user?.department_id || '',
            assign_account: !!t.username,
            username: t.username || '',
            password: ''
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setEditing(null);
        setForm({
            name: '',
            designation: 'Lecturer',
            seniority: '',
            max_contact_hours: 12,
            is_lab_engineer: false,
            department_id: parseInt(viewDeptId) || user?.department_id || '',
            assign_account: true,
            username: '',
            password: ''
        });
        setShowForm(false);
    };

    const downloadTemplate = async () => {
        try {
            const res = await api.get('/teachers/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'teacher_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) { alert('Failed to download template'); }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!selectedDept) {
            alert('Please select a department for bulk upload first.');
            return;
        }
        const fd = new FormData();
        fd.append('file', file);
        try {
            await api.post(`/teachers/upload?department_id=${selectedDept}`, fd);
            loadTeachers();
            alert('Upload successful');
        } catch (err) { alert(err.response?.data?.detail || 'Upload failed'); }
    };

    const canManageTeacher = (teacher) => {
        if (user?.role === 'super_admin') return true;
        return teacher.department_id === user?.department_id;
    };

    const isViewingOwnDept = user?.role === 'super_admin' || !viewDeptId || parseInt(viewDeptId) === user?.department_id;

    const handleUploadWithDept = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const targetDept = selectedDept || viewDeptId;
        if (!targetDept) {
            alert('Please select a department for bulk upload first.');
            return;
        }

        const fd = new FormData();
        fd.append('file', file);
        try {
            await api.post(`/teachers/upload?department_id=${targetDept}`, fd);
            loadTeachers(viewDeptId);
            alert('Upload successful');
        } catch (err) { alert(err.response?.data?.detail || 'Upload failed'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Teachers</h1>
                        <p className="text-sm text-slate-500">{teachers.length} teachers in this view</p>
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden md:block" />

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dept:</span>
                        <select
                            value={viewDeptId}
                            onChange={(e) => setViewDeptId(e.target.value)}
                            className="bg-transparent text-sm font-medium text-slate-600 outline-none min-w-[150px]"
                        >
                            <option value="">All Departments</option>
                            {depts.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden md:block" />

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session:</span>
                        <select
                            value={activeSessionId}
                            onChange={(e) => setActiveSessionId(e.target.value)}
                            className="bg-transparent text-sm font-medium text-slate-600 outline-none min-w-[120px]"
                        >
                            <option value="">All Sessions</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isViewingOwnDept && (
                        <>
                            <button onClick={downloadTemplate}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200
                                              text-sm text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                                Template
                            </button>
                            <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200
                                              text-sm text-primary-600 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border-dashed">
                                <HiOutlineUpload className="w-4 h-4" /> Bulk Upload
                                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUploadWithDept} className="hidden" />
                            </label>
                            <button onClick={() => setShowEngageModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200
                                              text-sm text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-medium">
                                <HiOutlinePlus className="w-4 h-4" /> Engage External
                            </button>
                            <button onClick={() => setShowForm(true)}
                                className="flex items-center gap-1.5 px-4 py-2 gradient-accent rounded-xl text-white
                                               text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-primary-500/20">
                                <HiOutlinePlus className="w-4 h-4" /> Add Teacher
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Engage External Modal */}
            {showEngageModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h2 className="font-bold text-slate-800">Engage Faculty from other Departments</h2>
                            <button onClick={() => { setShowEngageModal(false); setOtherTeachers([]); setSelectedDepartments([]); setSelectedTeachersToEngage([]); }} className="text-slate-400 hover:text-slate-600">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Department Selection with Checkboxes */}
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 ml-1">Select Departments</label>
                            <div className="grid grid-cols-2 gap-2">
                                {depts.filter(d => d.id !== user?.department_id).map(d => (
                                    <label key={d.id} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={selectedDepartments.includes(d.id)}
                                            onChange={() => toggleDepartment(d.id)}
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">{d.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Teachers List with Checkboxes */}
                        <div className="p-4 overflow-y-auto flex-1">
                            {selectedDepartments.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 text-sm italic">Please select at least one department to see faculty.</p>
                            ) : otherTeachers.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 text-sm italic">No teachers found in selected departments.</p>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500 font-medium mb-3">Select teachers to engage ({selectedTeachersToEngage.length} selected)</p>
                                    {otherTeachers.map(t => (
                                        <label key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedTeachersToEngage.includes(t.id)}
                                                onChange={() => toggleTeacher(t.id)}
                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-800 text-sm">{t.name}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                    {t.designation} • {depts.find(d => d.id === t.department_id)?.code || 'N/A'}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowEngageModal(false); setOtherTeachers([]); setSelectedDepartments([]); setSelectedTeachersToEngage([]); }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEngageMultiple}
                                disabled={selectedTeachersToEngage.length === 0}
                                className="px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Engage {selectedTeachersToEngage.length > 0 ? `(${selectedTeachersToEngage.length})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Teacher Assignments Modal */}
            {showAssignmentsModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="font-bold text-slate-800">Complete Teaching Profile - {activeTeacher?.name}</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    {activeTeacher?.designation} • All Departments & Sessions
                                </p>
                            </div>
                            <button onClick={() => setShowAssignmentsModal(false)} className="text-slate-400 hover:text-slate-600">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {(() => {
                                // Show ALL assignments across all sessions and departments
                                const filteredAssignments = teacherAssignments;

                                // Calculate total workload across all sessions
                                let totalTheoryLoad = 0;
                                let totalLabLoad = 0;
                                let totalHours = 0;

                                filteredAssignments.forEach(a => {
                                    const numSections = a.section_names?.length || 0;
                                    if (a.teacher_id === activeTeacher?.id) {
                                        const theoryCredits = (a.theory_credits || 0) * numSections;
                                        totalTheoryLoad += theoryCredits;
                                        totalHours += theoryCredits;
                                    }
                                    if (a.lab_engineer_id === activeTeacher?.id) {
                                        const labCredits = (a.lab_credits || 0) * numSections;
                                        totalLabLoad += labCredits;
                                        totalHours += labCredits * 3;
                                    }
                                });

                                if (filteredAssignments.length === 0) {
                                    return (
                                        <div className="text-center py-12">
                                            <p className="text-slate-400 text-sm italic">No assignments found for this teacher.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-4">
                                        {/* Total Workload Summary */}
                                        <div className="bg-gradient-to-r from-primary-50 to-indigo-50 p-4 rounded-xl border border-primary-100">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">Total Teaching Load</h3>
                                                    <p className="text-sm text-slate-600">Across all departments and sessions</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-bold text-primary-600">
                                                        {totalTheoryLoad.toFixed(1)} Th • {totalLabLoad.toFixed(1)} Lab
                                                    </p>
                                                    <p className="text-sm text-slate-500">
                                                        {totalHours.toFixed(1)} / {activeTeacher?.max_contact_hours} contact hours
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Assignments grouped by Session and Department */}
                                        {(() => {
                                            // Group assignments by session first, then by department
                                            const bySession = {};
                                            filteredAssignments.forEach(a => {
                                                const sessionKey = `${a.session_id}-${a.session_name}`;
                                                if (!bySession[sessionKey]) {
                                                    bySession[sessionKey] = {
                                                        sessionId: a.session_id,
                                                        sessionName: a.session_name,
                                                        departments: {}
                                                    };
                                                }
                                                
                                                const deptName = a.department_name || 'Unknown Department';
                                                if (!bySession[sessionKey].departments[deptName]) {
                                                    bySession[sessionKey].departments[deptName] = [];
                                                }
                                                bySession[sessionKey].departments[deptName].push(a);
                                            });

                                            return Object.values(bySession)
                                                .sort((a, b) => b.sessionId - a.sessionId) // Latest sessions first
                                                .map(session => (
                                                    <div key={session.sessionId} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
                                                            <h3 className="font-semibold text-slate-800">{session.sessionName}</h3>
                                                            <p className="text-sm text-slate-500">Session ID: {session.sessionId}</p>
                                                        </div>
                                                        
                                                        <div className="p-4 space-y-4">
                                                            {Object.entries(session.departments).map(([deptName, deptAssignments]) => {
                                                                const theoryAssignments = deptAssignments.filter(a => a.teacher_id === activeTeacher?.id);
                                                                const labAssignments = deptAssignments.filter(a => a.lab_engineer_id === activeTeacher?.id);
                                                                
                                                                const deptTheoryLoad = theoryAssignments.reduce((sum, a) => 
                                                                    sum + (a.theory_credits || 0) * (a.section_names?.length || 0), 0);
                                                                const deptLabLoad = labAssignments.reduce((sum, a) => 
                                                                    sum + (a.lab_credits || 0) * (a.section_names?.length || 0), 0);
                                                                const deptHours = deptTheoryLoad + (deptLabLoad * 3);

                                                                return (
                                                                    <div key={deptName} className="border border-slate-100 rounded-lg overflow-hidden">
                                                                        <div className="bg-gradient-to-r from-primary-50 to-indigo-50 px-3 py-2 border-b border-slate-100">
                                                                            <div className="flex items-center justify-between">
                                                                                <h4 className="font-medium text-slate-800">{deptName}</h4>
                                                                                <div className="text-right">
                                                                                    <p className="text-sm font-medium text-primary-600">
                                                                                        {deptTheoryLoad.toFixed(1)} Th • {deptLabLoad.toFixed(1)} Lab
                                                                                    </p>
                                                                                    <p className="text-xs text-slate-400">{deptHours.toFixed(1)} hrs</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {/* Theory Subjects */}
                                                                            <div>
                                                                                <h5 className="text-xs font-semibold text-indigo-600 mb-2 flex items-center gap-1">
                                                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                                                    Theory Subjects
                                                                                </h5>
                                                                                {theoryAssignments.length === 0 ? (
                                                                                    <p className="text-xs text-slate-400 italic">None assigned</p>
                                                                                ) : (
                                                                                    <div className="space-y-2">
                                                                                        {theoryAssignments.map(a => (
                                                                                            <div key={`th-${a.id}`} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                                                                <div className="flex items-center justify-between mb-1">
                                                                                                    <span className="text-sm font-medium text-slate-800">{a.subject_code}</span>
                                                                                                    <span className="text-xs text-slate-500">{a.theory_credits}cr</span>
                                                                                                </div>
                                                                                                <p className="text-xs text-slate-600 mb-1">{a.subject_full_name}</p>
                                                                                                <p className="text-xs text-slate-500">
                                                                                                    {a.batch_name} • Sections: {a.section_names?.join(', ') || 'None'}
                                                                                                </p>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Lab Subjects */}
                                                                            <div>
                                                                                <h5 className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1">
                                                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                                                    Lab Subjects
                                                                                </h5>
                                                                                {labAssignments.length === 0 ? (
                                                                                    <p className="text-xs text-slate-400 italic">None assigned</p>
                                                                                ) : (
                                                                                    <div className="space-y-2">
                                                                                        {labAssignments.map(a => (
                                                                                            <div key={`lab-${a.id}`} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                                                                <div className="flex items-center justify-between mb-1">
                                                                                                    <span className="text-sm font-medium text-slate-800">{a.subject_code}</span>
                                                                                                    <span className="text-xs text-slate-500">{a.lab_credits}cr</span>
                                                                                                </div>
                                                                                                <p className="text-xs text-slate-600 mb-1">{a.subject_full_name}</p>
                                                                                                <p className="text-xs text-slate-500">
                                                                                                    {a.batch_name} • Sections: {a.section_names?.join(', ') || 'None'}
                                                                                                </p>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ));
                                        })()}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="glass p-5 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-800">
                            {editing ? 'Edit Teacher' : 'Add Teacher'}
                        </h2>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <input type="number" value={form.seniority}
                                onChange={e => setForm(f => ({ ...f, seniority: e.target.value }))}
                                placeholder="S.No"
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                            <input value={form.name} onChange={e => handleNameChange(e.target.value)}
                                placeholder="Full Name" required
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 md:col-span-2" />

                            <select
                                required
                                disabled={user?.role !== 'super_admin'}
                                value={form.department_id}
                                onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                                className={`px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none ${user?.role !== 'super_admin' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <option value="">Select Dept</option>
                                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>

                            <select value={form.designation} onChange={e => handleDesignationChange(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                               text-sm focus:outline-none">
                                {Object.keys(designationHours).map(d => <option key={d}>{d}</option>)}
                            </select>

                            <div className="flex items-center gap-2">
                                <input type="number" value={form.max_contact_hours}
                                    onChange={e => setForm(f => ({ ...f, max_contact_hours: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                                  text-sm focus:outline-none" placeholder="Hrs" />
                                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap cursor-pointer">
                                    <input type="checkbox" checked={form.is_lab_engineer}
                                        onChange={e => setForm(f => ({ ...f, is_lab_engineer: e.target.checked }))}
                                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                    Lab
                                </label>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                            <label className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={form.assign_account}
                                    onChange={e => setForm(f => ({ ...f, assign_account: e.target.checked }))}
                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                Assign User Account / Set Password
                            </label>

                            {form.assign_account && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Username</label>
                                        <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                            placeholder="Username" required={form.assign_account}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm outline-none focus:border-primary-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">
                                            {editing ? 'New Password (Optional)' : 'Password'}
                                        </label>
                                        <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            placeholder={editing ? "Leave blank to keep same" : "Password"} required={form.assign_account && !editing}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm outline-none focus:border-primary-400" />
                                    </div>
                                    <div className="flex items-end">
                                        <p className="text-[11px] text-slate-400 italic mb-2">
                                            {editing ? "Will update existing user record." : "Default: name as username & password."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button type="submit"
                                className="px-6 py-2 gradient-accent text-white rounded-xl
                                               text-sm font-medium hover:opacity-90 shadow-md shadow-primary-500/20">
                                {editing ? 'Update Faculty Details' : 'Create Faculty Member'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table */}
            <div className="glass overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th onClick={() => handleSort('seniority')} className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors w-16">
                                    # {sortConfig.key === 'seniority' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('name')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('department_name')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Dept {sortConfig.key === 'department_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('designation')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Designation {sortConfig.key === 'designation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('max_contact_hours')} className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Max Hrs {sortConfig.key === 'max_contact_hours' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('current_load')} className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Workload {sortConfig.key === 'current_load' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTeachers.map(t => {
                                const isHome = user && t.department_id === user.department_id;
                                const isViewingOtherDept = viewDeptId && parseInt(viewDeptId) !== user?.department_id;
                                const loadPercent = Math.min(100, Math.round((t.current_load / t.max_contact_hours) * 100)) || 0;

                                return (
                                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-slate-600 group">
                                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-400">
                                            {t.seniority || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                            {t.name}
                                            {!isHome && (
                                                <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-500 text-[10px] rounded border border-indigo-100 font-bold uppercase">
                                                    Shared
                                                </span>
                                            )}
                                            {/* Only show username if viewing own department */}
                                            {!isViewingOtherDept && t.username && <span className="block text-[10px] text-slate-400 font-mono italic opacity-0 group-hover:opacity-100 transition-opacity">@{t.username}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                                {t.department_name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{t.designation}</td>
                                        <td className="px-4 py-3 text-sm text-center font-bold text-slate-700">{t.max_contact_hours}h</td>
                                        <td className="px-4 py-3 text-sm text-center min-w-[140px] cursor-pointer" onClick={() => handleViewAssignments(t)} title="Click to view assignments">
                                            <div className="flex flex-col items-center gap-1.5 hover:scale-105 transition-transform">
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden max-w-[90px]">
                                                    <div className={`h-full transition-all duration-500 ${loadPercent > 100 ? 'bg-red-500' :
                                                        loadPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`} style={{ width: `${loadPercent}%` }}></div>
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${loadPercent > 100 ? 'text-red-600 bg-red-50' :
                                                    loadPercent > 80 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'
                                                    }`}>
                                                    {t.current_theory_load || 0} Th, {t.current_lab_load || 0} Lab
                                                </span>
                                                {t.global_load > t.current_load && (
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                                                        Global: {t.global_load}h
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {/* If viewing other department, show read-only */}
                                            {isViewingOtherDept ? (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">Read Only</span>
                                            ) : isHome ? (
                                                <>
                                                    <button onClick={() => handleViewAssignments(t)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 transition-colors"
                                                        title="View Assignments">
                                                        <HiOutlinePlus className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => startEdit(t)}
                                                        className="p-1.5 text-slate-400 hover:text-primary-500 rounded-lg hover:bg-primary-50 transition-colors ml-1"
                                                        title="Edit Profile">
                                                        <HiOutlinePencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(t.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors ml-1"
                                                        title="Delete Faculty">
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => handleViewAssignments(t)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 transition-colors"
                                                        title="View Assignments">
                                                        <HiOutlinePlus className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleUnengage(t)}
                                                        className="px-2 py-1 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-100 rounded hover:bg-amber-100 transition-colors"
                                                        title="Remove from your department's shared list">
                                                        Unengage
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
