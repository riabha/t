import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlineCollection, HiOutlineTrash, HiOutlinePlus, HiOutlinePlusCircle, HiOutlineHashtag, HiOutlinePencil, HiOutlineX } from 'react-icons/hi';

export default function SectionsPage() {
    const [sections, setSections] = useState([]);
    const [batches, setBatches] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddBatch, setShowAddBatch] = useState(false);
    const [activeAddSection, setActiveAddSection] = useState(null); // ID of batch adding section to

    const [editingBatch, setEditingBatch] = useState(null);
    const [editingSection, setEditingSection] = useState(null);

    const [newBatch, setNewBatch] = useState({ year: new Date().getFullYear(), semester: 1, department_id: '' });
    const [newSection, setNewSection] = useState({ name: '', room_id: '' });

    useEffect(() => {
        loadData();
    }, []);

    // Helper functions for morning lab mode display
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

    const getModeTooltip = (batch) => {
        if (!batch.morning_lab_mode) return '';
        
        let tooltip = `Morning Lab Mode: ${getModeLabel(batch.morning_lab_mode)}`;
        if (batch.morning_lab_mode === 'count' && batch.morning_lab_count) {
            tooltip += `\nRequired: ${batch.morning_lab_count} labs`;
        }
        if (batch.morning_lab_days && batch.morning_lab_days.length > 0) {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            tooltip += `\nDays: ${batch.morning_lab_days.map(d => days[d]).join(', ')}`;
        }
        return tooltip;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [sRes, bRes, rRes, dRes] = await Promise.all([
                api.get('/departments/sections'),
                api.get('/departments/batches'),
                api.get('/rooms/'),
                api.get('/departments/')
            ]);
            setSections(sRes.data);
            setBatches(bRes.data);
            setRooms(rRes.data);
            setDepartments(dRes.data);

            if (dRes.data.length > 0 && !newBatch.department_id) {
                setNewBatch(prev => ({ ...prev, department_id: dRes.data[0].id }));
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleCreateBatch = async (e) => {
        e.preventDefault();
        try {
            await api.post('/departments/batches', newBatch);
            setShowAddBatch(false);
            loadData();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to create batch'); }
    };

    const handleUpdateBatch = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/departments/batches/${editingBatch.id}`, editingBatch);
            setEditingBatch(null);
            loadData();
        } catch (err) { alert(err.response?.data?.detail || 'Update failed'); }
    };

    const handleCreateSection = async (batchId) => {
        if (!newSection.name) return;
        try {
            await api.post('/departments/sections', { ...newSection, batch_id: batchId });
            setNewSection({ name: '', room_id: '' });
            setActiveAddSection(null);
            loadData();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to create section'); }
    };

    const handleUpdateSection = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/departments/sections/${editingSection.id}`, editingSection);
            setEditingSection(null);
            loadData();
        } catch (err) { alert(err.response?.data?.detail || 'Update failed'); }
    };

    const handleDeleteSection = async (id) => {
        if (!window.confirm('Delete section?')) return;
        try {
            await api.delete(`/departments/sections/${id}`);
            loadData();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to delete'); }
    };

    const handleDeleteBatch = async (id) => {
        if (!window.confirm('Delete this batch? This will remove all its sections and associated assignments.')) return;
        try {
            await api.delete(`/departments/batches/${id}`);
            loadData();
        } catch (err) { alert(err.response?.data?.detail || 'Failed to delete batch'); }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Batches & Sections</h1>
                    <p className="text-sm text-slate-500">Manage academic years and their section subdivisions</p>
                </div>
                <button
                    onClick={() => setShowAddBatch(true)}
                    className="flex items-center gap-1.5 px-4 py-2 gradient-accent rounded-xl text-white text-sm font-medium hover:opacity-90 transition-all shadow-md shadow-primary-500/20"
                >
                    <HiOutlinePlus className="w-4 h-4" /> Add Batch
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-full py-10 text-center text-slate-400">Loading academic data...</div>
                ) : batches.map(b => (
                    /* ... (rest of the batch card code as before) ... */
                    <div key={b.id} className="glass overflow-hidden flex flex-col hover:border-primary-200 transition-all group">
                        {/* Batch Header */}
                        <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center text-white shadow-sm">
                                    <HiOutlineHashtag className="w-5 h-5" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">{b.display_name}</h3>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{b.semester} Semester</p>
                                    </div>
                                    {b.morning_lab_mode && (
                                        <span 
                                            className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getModeColor(b.morning_lab_mode)}`}
                                            title={getModeTooltip(b)}
                                        >
                                            {b.morning_lab_mode === 'strict' && '🌅'}
                                            {b.morning_lab_mode === 'prefer' && '☀️'}
                                            {b.morning_lab_mode === 'count' && `📊 ${b.morning_lab_count || 0}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingBatch({ ...b })}
                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                    title="Edit Batch"
                                >
                                    <HiOutlinePencil className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setActiveAddSection(activeAddSection === b.id ? null : b.id)}
                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                    title="Add Section"
                                >
                                    <HiOutlinePlusCircle className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteBatch(b.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Sections List */}
                        <div className="p-5 flex-1 bg-white/40">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {sections.filter(s => s.batch_id === b.id).length === 0 ? (
                                    <div className="col-span-full py-6 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                                        <HiOutlineCollection className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-xs font-medium italic">No sections created for this batch</p>
                                        <button
                                            onClick={() => setActiveAddSection(b.id)}
                                            className="mt-2 text-[10px] text-primary-500 font-bold hover:underline"
                                        >
                                            + Add First Section
                                        </button>
                                    </div>
                                ) : sections.filter(s => s.batch_id === b.id).map(s => (
                                    <div key={s.id} className="relative group/sec flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm hover:border-primary-200 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">Section {s.name}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {rooms.find(r => r.id === s.room_id)?.name || 'No Room'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditingSection({ ...s })}
                                                className="p-1.5 text-slate-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                            >
                                                <HiOutlinePencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSection(s.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Inline Add Section Form */}
                        {activeAddSection === b.id && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in slide-in-from-bottom-2 duration-200">
                                <div className="flex gap-3">
                                    <input
                                        autoFocus
                                        placeholder="Name (A, B...)"
                                        value={newSection.name}
                                        onChange={e => setNewSection({ ...newSection, name: e.target.value })}
                                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                    />
                                    <select
                                        value={newSection.room_id}
                                        onChange={e => setNewSection({ ...newSection, room_id: e.target.value })}
                                        className="w-1/3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                    >
                                        <option value="">Room (Opt)</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    <button
                                        onClick={() => handleCreateSection(b.id)}
                                        className="px-4 py-1.5 gradient-accent text-white text-xs font-bold rounded-lg shadow-sm"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Batch Modal */}
            {showAddBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-left">
                    <div className="glass max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Add New Batch</h2>
                            <button onClick={() => setShowAddBatch(false)} className="text-slate-400 hover:text-slate-600">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateBatch} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Academic Year</label>
                                <input
                                    type="number"
                                    value={newBatch.year}
                                    onChange={e => setNewBatch({ ...newBatch, year: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Current Semester</label>
                                <select
                                    value={newBatch.semester}
                                    onChange={e => setNewBatch({ ...newBatch, semester: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={s}>{s} Semester</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Department</label>
                                <select
                                    value={newBatch.department_id}
                                    onChange={e => setNewBatch({ ...newBatch, department_id: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                                >
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowAddBatch(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">Cancel</button>
                                <button type="submit" className="flex-1 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Batch Modal */}
            {editingBatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-left">
                    <div className="glass max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Edit Batch</h2>
                            <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateBatch} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Academic Year</label>
                                <input
                                    type="number"
                                    value={editingBatch.year}
                                    onChange={e => setEditingBatch({ ...editingBatch, year: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Current Semester</label>
                                <select
                                    value={editingBatch.semester}
                                    onChange={e => setEditingBatch({ ...editingBatch, semester: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={s}>{s} Semester</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setEditingBatch(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">Cancel</button>
                                <button type="submit" className="flex-1 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Section Modal */}
            {editingSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-left">
                    <div className="glass max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Edit Section</h2>
                            <button onClick={() => setEditingSection(null)} className="text-slate-400 hover:text-slate-600">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateSection} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Section Name</label>
                                <input
                                    value={editingSection.name}
                                    onChange={e => setEditingSection({ ...editingSection, name: e.target.value })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Default Room (Optional)</label>
                                <select
                                    value={editingSection.room_id || ''}
                                    onChange={e => setEditingSection({ ...editingSection, room_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                                >
                                    <option value="">No Room</option>
                                    {rooms.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setEditingSection(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">Cancel</button>
                                <button type="submit" className="flex-1 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
