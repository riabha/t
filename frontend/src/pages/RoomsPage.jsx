import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function RoomsPage() {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', capacity: '', is_lab: false, department_id: '' });
    const [showForm, setShowForm] = useState(false);
    const [showBulkClassroomForm, setShowBulkClassroomForm] = useState(false);
    const [showBulkLabForm, setShowBulkLabForm] = useState(false);
    const [showBulkDelete, setShowBulkDelete] = useState(false);
    const [selectedRooms, setSelectedRooms] = useState([]);
    const [bulkClassroomForm, setBulkClassroomForm] = useState({ 
        count: 8, 
        capacity: 40,
        department_id: ''
    });
    const [bulkLabForm, setBulkLabForm] = useState({ 
        count: 4, 
        capacity: 30,
        department_id: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const [roomsRes, deptsRes] = await Promise.all([
            api.get('/rooms/'),
            api.get('/departments/')
        ]);
        setRooms(roomsRes.data);
        setDepartments(deptsRes.data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: form.name,
                capacity: form.capacity ? parseInt(form.capacity) : null,
                is_lab: form.is_lab,
                department_id: user?.role === 'super_admin' ? (form.department_id || null) : null
            };
            if (editing) {
                await api.put(`/rooms/${editing}`, payload);
            } else {
                await api.post('/rooms/', payload);
            }
            loadData();
            resetForm();
        } catch (e) { 
            console.error('Room operation error:', e.response?.data);
            alert(e.response?.data?.detail || 'Error with room operation'); 
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this room?')) return;
        try {
            await api.delete(`/rooms/${id}`);
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Error deleting room');
        }
    };

    const startEdit = (r) => {
        setEditing(r.id);
        setForm({ 
            name: r.name, 
            capacity: r.capacity || '', 
            is_lab: r.is_lab || false,
            department_id: r.department_id || ''
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setEditing(null);
        setForm({ name: '', capacity: '', is_lab: false, department_id: '' });
        setShowForm(false);
    };

    const handleBulkCreateClassrooms = async (e) => {
        e.preventDefault();
        try {
            const count = parseInt(bulkClassroomForm.count) || 0;
            
            if (count === 0) {
                alert('Please specify number of classrooms');
                return;
            }

            if (user?.role === 'super_admin' && !bulkClassroomForm.department_id) {
                alert('Please select a department');
                return;
            }

            const deptId = user?.role === 'super_admin' 
                ? parseInt(bulkClassroomForm.department_id) 
                : null;
            
            const existingNames = rooms
                .filter(r => !r.is_lab && (user?.role === 'super_admin' ? r.department_id === deptId : true))
                .map(r => r.name);
            
            let crStart = 1;
            while (existingNames.includes(`CR-${crStart.toString().padStart(2, '0')}`)) {
                crStart++;
            }
            
            const roomsToCreate = [];
            for (let i = 0; i < count; i++) {
                roomsToCreate.push({
                    name: `CR-${(crStart + i).toString().padStart(2, '0')}`,
                    capacity: parseInt(bulkClassroomForm.capacity) || 40,
                    is_lab: false,
                    department_id: deptId
                });
            }

            const results = await Promise.allSettled(
                roomsToCreate.map(room => api.post('/rooms/', room))
            );
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (failed > 0) {
                alert(`Created ${successful} classrooms. ${failed} failed.`);
            } else {
                alert(`Successfully created ${count} classrooms!`);
            }
            
            loadData();
            setShowBulkClassroomForm(false);
            setBulkClassroomForm({ count: 8, capacity: 40, department_id: '' });
        } catch (e) {
            console.error('Bulk creation error:', e.response?.data);
            alert(e.response?.data?.detail || 'Error creating classrooms');
        }
    };

    const handleBulkCreateLabs = async (e) => {
        e.preventDefault();
        try {
            const count = parseInt(bulkLabForm.count) || 0;
            
            if (count === 0) {
                alert('Please specify number of labs');
                return;
            }

            if (user?.role === 'super_admin' && !bulkLabForm.department_id) {
                alert('Please select a department');
                return;
            }

            const deptId = user?.role === 'super_admin' 
                ? parseInt(bulkLabForm.department_id) 
                : null;
            
            const existingNames = rooms
                .filter(r => r.is_lab && (user?.role === 'super_admin' ? r.department_id === deptId : true))
                .map(r => r.name);
            
            let labStart = 1;
            while (existingNames.includes(`Lab-${labStart.toString().padStart(2, '0')}`)) {
                labStart++;
            }
            
            const roomsToCreate = [];
            for (let i = 0; i < count; i++) {
                roomsToCreate.push({
                    name: `Lab-${(labStart + i).toString().padStart(2, '0')}`,
                    capacity: parseInt(bulkLabForm.capacity) || 30,
                    is_lab: true,
                    department_id: deptId
                });
            }

            const results = await Promise.allSettled(
                roomsToCreate.map(room => api.post('/rooms/', room))
            );
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (failed > 0) {
                alert(`Created ${successful} labs. ${failed} failed.`);
            } else {
                alert(`Successfully created ${count} labs!`);
            }
            
            loadData();
            setShowBulkLabForm(false);
            setBulkLabForm({ count: 4, capacity: 30, department_id: '' });
        } catch (e) {
            console.error('Bulk creation error:', e.response?.data);
            alert(e.response?.data?.detail || 'Error creating labs');
        }
    };

    const toggleRoomSelection = (roomId) => {
        setSelectedRooms(prev => 
            prev.includes(roomId) 
                ? prev.filter(id => id !== roomId)
                : [...prev, roomId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRooms.length === rooms.length) {
            setSelectedRooms([]);
        } else {
            setSelectedRooms(rooms.map(r => r.id));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRooms.length === 0) {
            alert('Please select rooms to delete');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedRooms.length} room(s)?`)) {
            return;
        }

        try {
            const results = await Promise.allSettled(
                selectedRooms.map(id => api.delete(`/rooms/${id}`))
            );
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (failed > 0) {
                alert(`Deleted ${successful} rooms. ${failed} failed (may be in use).`);
            } else {
                alert(`Successfully deleted ${successful} rooms!`);
            }
            
            setSelectedRooms([]);
            setShowBulkDelete(false);
            loadData();
        } catch (e) {
            console.error('Bulk delete error:', e.response?.data);
            alert('Error deleting rooms');
        }
    };

    // Group rooms by department for super admin
    const groupedRooms = user?.role === 'super_admin' 
        ? departments.reduce((acc, dept) => {
            acc[dept.id] = {
                name: dept.name,
                code: dept.code,
                rooms: rooms.filter(r => r.department_id === dept.id)
            };
            return acc;
        }, {})
        : null;

    if (!user) {
        return <div className="p-10 text-center text-slate-400">Loading...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Classrooms & Labs</h1>
                    <p className="text-sm text-slate-500">
                        {user?.role === 'super_admin' 
                            ? `${rooms.length} rooms across all departments`
                            : `${rooms.length} rooms in your department`
                        }
                    </p>
                </div>
                <div className="flex gap-2">
                    {showBulkDelete ? (
                        <>
                            <button onClick={() => { setShowBulkDelete(false); setSelectedRooms([]); }}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300">
                                Cancel Selection
                            </button>
                            <button onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 rounded-xl text-white
                                           text-sm font-medium hover:bg-red-700 transition-colors shadow-md">
                                <HiOutlineTrash className="w-4 h-4" /> Delete Selected ({selectedRooms.length})
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setShowBulkDelete(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-xl
                                           text-sm font-medium hover:bg-red-200 transition-colors">
                                <HiOutlineTrash className="w-4 h-4" /> Bulk Delete
                            </button>
                            <button onClick={() => setShowBulkLabForm(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 rounded-xl text-white
                                           text-sm font-medium hover:bg-indigo-700 transition-colors shadow-md">
                                <HiOutlinePlus className="w-4 h-4" /> Bulk Labs
                            </button>
                            <button onClick={() => setShowBulkClassroomForm(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 rounded-xl text-white
                                           text-sm font-medium hover:bg-slate-600 transition-colors shadow-md">
                                <HiOutlinePlus className="w-4 h-4" /> Bulk Classrooms
                            </button>
                            <button onClick={() => setShowForm(true)}
                                className="flex items-center gap-1.5 px-4 py-2 gradient-accent rounded-xl text-white
                                           text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-primary-500/20">
                                <HiOutlinePlus className="w-4 h-4" /> Add Room
                            </button>
                        </>
                    )}
                </div>
            </div>

            {showBulkDelete && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-amber-800 font-medium">
                            🗑️ Bulk Delete Mode: Click on rooms to select them for deletion
                        </p>
                        <button 
                            onClick={toggleSelectAll}
                            className="text-xs font-bold text-amber-700 hover:text-amber-900 underline">
                            {selectedRooms.length === rooms.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                </div>
            )}

            {showBulkClassroomForm && (
                <div className="glass p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-800">Bulk Create Classrooms</h2>
                        <button onClick={() => setShowBulkClassroomForm(false)} className="text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleBulkCreateClassrooms} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Number of Classrooms
                                </label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={bulkClassroomForm.count}
                                    onChange={e => setBulkClassroomForm({ ...bulkClassroomForm, count: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Capacity per Classroom
                                </label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={bulkClassroomForm.capacity}
                                    onChange={e => setBulkClassroomForm({ ...bulkClassroomForm, capacity: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                />
                            </div>
                        </div>

                        {user?.role === 'super_admin' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Department
                                </label>
                                <select 
                                    value={bulkClassroomForm.department_id} 
                                    onChange={e => setBulkClassroomForm({ ...bulkClassroomForm, department_id: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-xs text-blue-700 font-medium">
                                🏫 This will create <span className="font-bold">{bulkClassroomForm.count || 0} classrooms</span> named CR-01, CR-02, CR-03...
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setShowBulkClassroomForm(false)}
                                className="px-5 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300">
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="px-5 py-2 bg-slate-700 text-white rounded-xl text-sm
                                           font-medium hover:bg-slate-600 shadow-md">
                                Create Classrooms
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showBulkLabForm && (
                <div className="glass p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-800">Bulk Create Labs</h2>
                        <button onClick={() => setShowBulkLabForm(false)} className="text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleBulkCreateLabs} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Number of Labs
                                </label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={bulkLabForm.count}
                                    onChange={e => setBulkLabForm({ ...bulkLabForm, count: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Capacity per Lab
                                </label>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={bulkLabForm.capacity}
                                    onChange={e => setBulkLabForm({ ...bulkLabForm, capacity: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                />
                            </div>
                        </div>

                        {user?.role === 'super_admin' && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Department
                                </label>
                                <select 
                                    value={bulkLabForm.department_id} 
                                    onChange={e => setBulkLabForm({ ...bulkLabForm, department_id: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <p className="text-xs text-indigo-700 font-medium">
                                🧪 This will create <span className="font-bold">{bulkLabForm.count || 0} labs</span> named Lab-01, Lab-02, Lab-03...
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={() => setShowBulkLabForm(false)}
                                className="px-5 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300">
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm
                                           font-medium hover:bg-indigo-700 shadow-md">
                                Create Labs
                            </button>
                        </div>
                    </form>
                </div>
            )}


            {showForm && (
                <div className="glass p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-slate-800">{editing ? 'Edit Room' : 'Add Room'}</h2>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex gap-4 flex-wrap items-end">
                        <div className="flex-1 min-w-[200px] space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Room Name</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. CR-01 or Lab-01" required
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        </div>
                        <div className="w-[100px] space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Capacity</label>
                            <input value={form.capacity} type="number" onChange={e => setForm({ ...form, capacity: e.target.value })}
                                placeholder="30"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        </div>
                        {user?.role === 'super_admin' && (
                            <div className="w-[180px] space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Department</label>
                                <select 
                                    value={form.department_id} 
                                    onChange={e => setForm({ ...form, department_id: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                              text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-3">
                            <input
                                type="checkbox"
                                id="isLab"
                                checked={form.is_lab}
                                onChange={e => setForm({ ...form, is_lab: e.target.checked })}
                                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                            />
                            <label htmlFor="isLab" className="text-xs font-bold text-slate-600 uppercase">This is a Lab</label>
                        </div>
                        <button type="submit" className="px-5 py-2 gradient-accent text-white rounded-xl text-sm
                                   font-medium hover:opacity-90 shadow-md shadow-primary-500/20">
                            {editing ? 'Update' : 'Create'}
                        </button>
                    </form>
                </div>
            )}

            {user?.role === 'super_admin' ? (
                // Super admin view: grouped by department
                <div className="space-y-6">
                    {groupedRooms && Object.entries(groupedRooms).map(([deptId, dept]) => (
                        dept.rooms.length > 0 && (
                            <div key={deptId} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-700">{dept.name}</h3>
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">
                                        {dept.rooms.length} rooms
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {dept.rooms.map(r => (
                                        <RoomCard 
                                            key={r.id} 
                                            room={r} 
                                            onEdit={startEdit} 
                                            onDelete={handleDelete}
                                            isSelectable={showBulkDelete}
                                            isSelected={selectedRooms.includes(r.id)}
                                            onToggleSelect={toggleRoomSelection}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                // Regular admin view: flat list
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {rooms.map(r => (
                        <RoomCard 
                            key={r.id} 
                            room={r} 
                            onEdit={startEdit} 
                            onDelete={handleDelete}
                            isSelectable={showBulkDelete}
                            isSelected={selectedRooms.includes(r.id)}
                            onToggleSelect={toggleRoomSelection}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function RoomCard({ room, onEdit, onDelete, isSelectable, isSelected, onToggleSelect }) {
    return (
        <div 
            className={`glass p-4 group hover:shadow-md transition-all cursor-pointer ${
                isSelected ? 'ring-2 ring-red-500 bg-red-50' : ''
            }`}
            onClick={() => isSelectable && onToggleSelect(room.id)}
        >
            <div className="flex items-center justify-between">
                <div className={`w-10 h-10 ${room.is_lab ? 'bg-primary-50' : 'bg-amber-50'} rounded-xl flex items-center justify-center mb-2`}>
                    <span className="text-lg">{room.is_lab ? '🧪' : '🏫'}</span>
                </div>
                {isSelectable ? (
                    <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => onToggleSelect(room.id)}
                        className="w-5 h-5 text-red-600 border-slate-300 rounded focus:ring-red-500"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(room); }}
                            className="p-1 text-slate-400 hover:text-primary-500 rounded hover:bg-primary-50">
                            <HiOutlinePencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(room.id); }}
                            className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50">
                            <HiOutlineTrash className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
            <p className="text-sm font-semibold text-slate-800">{room.name}</p>
            <div className="flex justify-between items-center mt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {room.is_lab ? 'Laboratory' : 'Classroom'}
                    {room.capacity ? ` • Cap: ${room.capacity}` : ''}
                </p>
            </div>
        </div>
    );
}
