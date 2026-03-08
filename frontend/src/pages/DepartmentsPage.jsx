import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineOfficeBuilding } from 'react-icons/hi';

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', code: '' });
    const [showForm, setShowForm] = useState(false);

    useEffect(() => { loadDepartments(); }, []);

    const loadDepartments = async () => {
        try {
            const res = await api.get('/departments/');
            setDepartments(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editing) {
                await api.put(`/departments/${editing}`, form);
            } else {
                await api.post('/departments/', form);
            }
            loadDepartments();
            resetForm();
        } catch (err) { alert(err.response?.data?.detail || 'Error saving department'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? This will delete all batches and sections in this department.')) return;
        try {
            await api.delete(`/departments/${id}`);
            loadDepartments();
        } catch (err) { alert('Failed to delete department'); }
    };

    const startEdit = (d) => {
        setEditing(d.id);
        setForm({ name: d.name, code: d.code });
        setShowForm(true);
    };

    const resetForm = () => {
        setEditing(null);
        setForm({ name: '', code: '' });
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Departments</h1>
                    <p className="text-sm text-slate-500">Manage academic departments and codes</p>
                </div>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 gradient-accent rounded-xl text-white
                                   text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-primary-500/20">
                    <HiOutlinePlus className="w-4 h-4" /> Add Department
                </button>
            </div>

            {showForm && (
                <div className="glass p-5 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-800">
                            {editing ? 'Edit Department' : 'Create New Department'}
                        </h2>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Department Name (e.g. Civil Engineering)"
                            required
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400 md:col-span-2"
                        />
                        <div className="flex gap-2">
                            <input
                                value={form.code}
                                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                placeholder="Code (e.g. CE)"
                                required
                                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                            />
                            <button type="submit"
                                className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
                                {editing ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map(dept => (
                    <div key={dept.id} className="glass p-4 group flex items-center justify-between hover:border-primary-200 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                                <HiOutlineOfficeBuilding className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">{dept.name}</h3>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dept.code}</span>
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(dept)}
                                className="p-1.5 text-slate-400 hover:text-primary-500 rounded-lg hover:bg-primary-50">
                                <HiOutlinePencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(dept.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                                <HiOutlineTrash className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
