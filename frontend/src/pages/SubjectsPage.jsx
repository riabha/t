import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineFilter, HiOutlineDownload, HiOutlineUpload } from 'react-icons/hi';

export default function SubjectsPage() {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [viewDeptId, setViewDeptId] = useState(user?.department_id || '');
    const [viewSemester, setViewSemester] = useState('');
    const [editing, setEditing] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'code', direction: 'asc' });
    const [form, setForm] = useState({ code: '', full_name: '', theory_credits: 3, lab_credits: 0, department_id: user?.department_id || '', semester: '' });
    const [showForm, setShowForm] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => { loadData(); }, [viewDeptId, viewSemester]);

    const loadData = async () => {
        try {
            const params = {};
            if (viewDeptId) params.department_id = viewDeptId;
            if (viewSemester) params.semester = viewSemester;

            const [sRes, dRes] = await Promise.all([
                api.get('/subjects/', { params }),
                api.get('/departments/')
            ]);
            setSubjects(sRes.data);
            setDepartments(dRes.data);
        } catch (e) {
            console.error('Failed to load subjects', e);
            setSubjects([]); // Graceful failure
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedSubjects = [...subjects].sort((a, b) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dId = parseInt(form.department_id);
            const payload = {
                ...form,
                theory_credits: parseInt(form.theory_credits) || 0,
                lab_credits: parseInt(form.lab_credits) || 0,
                department_id: !isNaN(dId) ? dId : (user?.department_id || null),
                semester: (form.semester === '' || form.semester === null) ? null : parseInt(form.semester)
            };

            if (editing) {
                await api.put(`/subjects/${editing}`, payload);
            } else {
                await api.post('/subjects/', payload);
            }
            loadData();
            resetForm();
        } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this subject?')) return;
        await api.delete(`/subjects/${id}`);
        loadData();
    };

    const startEdit = (s) => {
        setEditing(s.id);
        setForm({
            code: s.code,
            full_name: s.full_name,
            theory_credits: s.theory_credits,
            lab_credits: s.lab_credits,
            department_id: s.department_id || '',
            semester: s.semester || ''
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setEditing(null);
        setForm({ code: '', full_name: '', theory_credits: 3, lab_credits: 0, department_id: user?.department_id || '', semester: '' });
        setShowForm(false);
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await api.get('/subjects/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'subject_template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) { alert('Failed to download template'); }
    };

    const handleBulkUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(true);
        try {
            const res = await api.post('/subjects/bulk-upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(`Successfully added ${res.data.added} subjects!`);
            if (res.data.errors.length > 0) {
                console.warn('Upload errors:', res.data.errors);
                alert(`Some rows had errors. Check console (F12) for details.`);
            }
            loadData();
        } catch (err) {
            alert(err.response?.data?.detail || 'Bulk upload failed');
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const canManageSubject = (subject) => {
        if (user?.role === 'super_admin') return true;
        // Dept Admin/Clerk can only manage their own dept subjects
        return parseInt(subject.department_id) === user?.department_id;
    };

    const isViewingOwnDept = user?.role === 'super_admin' || !viewDeptId || parseInt(viewDeptId) === user?.department_id;

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Subjects</h1>
                    <p className="text-sm text-slate-500">{subjects.length} subjects in this view</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
                        title="Download CSV Template"
                    >
                        <HiOutlineDownload className="w-4 h-4" /> Template
                    </button>

                    <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
                        <HiOutlineUpload className={`w-4 h-4 ${isUploading ? 'animate-bounce text-primary-500' : ''}`} />
                        {isUploading ? 'Uploading...' : 'Bulk Upload'}
                        <input type="file" accept=".csv" onChange={handleBulkUpload} hidden disabled={isUploading} />
                    </label>

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <HiOutlineFilter className="w-4 h-4 text-slate-400" />
                        <select
                            value={viewDeptId}
                            onChange={(e) => setViewDeptId(e.target.value)}
                            className="bg-transparent text-sm font-medium text-slate-600 outline-none min-w-[150px]"
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <HiOutlineFilter className="w-4 h-4 text-slate-400" />
                        <select
                            value={viewSemester}
                            onChange={(e) => setViewSemester(e.target.value)}
                            className="bg-transparent text-sm font-medium text-slate-600 outline-none"
                        >
                            <option value="">All Terms</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                <option key={s} value={s}>{s === 1 ? '1st' : s === 2 ? '2nd' : s === 3 ? '3rd' : `${s}th`} Term</option>
                            ))}
                        </select>
                    </div>

                    {isViewingOwnDept && (
                        <button onClick={() => setShowForm(true)}
                            className="flex items-center gap-1.5 px-4 py-2 gradient-accent rounded-xl text-white
                                           text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-primary-500/20">
                            <HiOutlinePlus className="w-4 h-4" /> Add Subject
                        </button>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="glass p-5 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-800">
                            {editing ? 'Edit Subject' : 'Add Subject'}
                            {editing && <span className="ml-2 text-[10px] text-slate-400 font-normal underline">Editing existing record</span>}
                        </h2>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                        <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                            placeholder="Code (e.g. CE-111)" required
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                          text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                            placeholder="Full Name" required className="sm:col-span-2
                               px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />

                        <select
                            required
                            disabled={user?.role !== 'super_admin'}
                            value={form.department_id}
                            onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                            className={`px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none ${user?.role !== 'super_admin' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Dept</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>

                        <select
                            value={form.semester}
                            onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
                        >
                            <option value="">Term (Sem)</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                <option key={s} value={s}>{s}th Term</option>
                            ))}
                        </select>

                        <div className="flex gap-2 lg:col-span-2">
                            <input type="number" value={form.theory_credits}
                                onChange={e => setForm(f => ({ ...f, theory_credits: parseInt(e.target.value) }))}
                                className="w-1/3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none" placeholder="Th" min={0} title="Theory Credits" />
                            <input type="number" value={form.lab_credits}
                                onChange={e => setForm(f => ({ ...f, lab_credits: parseInt(e.target.value) }))}
                                className="w-1/3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none" placeholder="Lb" min={0} title="Lab Credits" />
                            <button type="submit"
                                className="flex-1 px-4 py-2 gradient-accent text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-md shadow-primary-500/20">
                                {editing ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="glass overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th onClick={() => handleSort('code')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Code {sortConfig.key === 'code' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('full_name')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Full Name {sortConfig.key === 'full_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('department_name')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Dept {sortConfig.key === 'department_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th onClick={() => handleSort('semester')} className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition-colors">
                                    Term {sortConfig.key === 'semester' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Theory</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Lab</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSubjects.map(s => (
                                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                                            {s.code}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{s.full_name}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                            {s.department_name || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center">
                                        {s.semester ? (
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                                {s.semester}{s.semester === 1 ? 'st' : s.semester === 2 ? 'nd' : s.semester === 3 ? 'rd' : 'th'} Term
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 italic text-[10px]">No Term</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-center text-slate-600">{s.theory_credits}</td>
                                    <td className="px-4 py-3 text-sm text-center text-slate-600">{s.lab_credits}</td>
                                    <td className="px-4 py-3 text-sm text-center font-medium text-slate-800">
                                        {(s.theory_credits || 0) + (s.lab_credits || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {canManageSubject(s) ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => startEdit(s)}
                                                    className="p-1.5 text-slate-400 hover:text-primary-500 rounded-lg hover:bg-primary-50 transition-colors"
                                                    title="Edit Subject"
                                                >
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(s.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Delete Subject"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">Read Only</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
