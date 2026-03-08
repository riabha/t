import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlineUserAdd, HiOutlineTrash, HiOutlineUserGroup, HiOutlineShieldCheck, HiOutlineCheck, HiOutlineX, HiOutlinePencil } from 'react-icons/hi';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'department_name', direction: 'asc' });

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'program_admin',
        department_id: '',
        can_manage_restrictions: false,
        can_delete_timetable: false,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [uRes, dRes] = await Promise.all([
                api.get('/users/'),
                api.get('/departments/')
            ]);
            setUsers(uRes.data);
            setDepartments(dRes.data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        // Validate: clerk must have a department
        if (formData.role === 'clerk' && !formData.department_id) {
            alert('Clerk must be assigned to a department');
            return;
        }
        try {
            const payload = { ...formData };
            // Clerks don't get admin permissions
            if (payload.role === 'clerk') {
                payload.can_manage_restrictions = false;
                payload.can_delete_timetable = false;
            }
            
            if (editingUser) {
                // Update existing user
                const updatePayload = { ...payload };
                delete updatePayload.password; // Don't send password on update
                await api.put(`/users/${editingUser.id}`, updatePayload);
            } else {
                // Create new user
                await api.post('/users/', payload);
            }
            
            resetForm();
            loadData();
        } catch (err) {
            alert(err.response?.data?.detail || `Failed to ${editingUser ? 'update' : 'create'} user`);
        }
    };

    const startEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '', // Don't populate password
            full_name: user.full_name,
            role: user.role,
            department_id: user.department_id || '',
            can_manage_restrictions: user.can_manage_restrictions,
            can_delete_timetable: user.can_delete_timetable,
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setEditingUser(null);
        setFormData({
            username: '', password: '', full_name: '',
            role: 'program_admin', department_id: '',
            can_manage_restrictions: false, can_delete_timetable: false,
        });
        setShowForm(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to delete user');
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = [...users].sort((a, b) => {
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

    const isAdminRole = formData.role === 'program_admin';
    const isClerkRole = formData.role === 'clerk';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">User Management</h1>
                    <p className="text-sm text-slate-500">Manage admins, clerks and their permissions</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 gradient-accent text-white rounded-xl text-sm font-medium shadow-md shadow-primary-500/20"
                >
                    <HiOutlineUserAdd className="w-5 h-5" />
                    {showForm ? 'Cancel' : 'Add User'}
                </button>
            </div>

            {showForm && (
                <div className="glass p-6 animate-in slide-in-from-top duration-300">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">
                        {editingUser ? 'Edit User' : 'Create New User'}
                    </h2>
                    <form onSubmit={handleCreate} className="space-y-5">
                        {/* Basic Info Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">Full Name</label>
                                <input
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="e.g. John Doe"
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">Username</label>
                                <input
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="e.g. john.doe"
                                    disabled={!!editingUser}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400 disabled:opacity-50"
                                />
                                {editingUser && <p className="text-xs text-slate-400 ml-1">Username cannot be changed</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">
                                    Password {editingUser && <span className="text-slate-400">(leave blank to keep current)</span>}
                                </label>
                                <input
                                    required={!editingUser}
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                />
                            </div>
                        </div>

                        {/* Role + Department Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({
                                        ...formData,
                                        role: e.target.value,
                                        can_manage_restrictions: false,
                                        can_delete_timetable: false,
                                    })}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                >
                                    <option value="program_admin">Department Admin</option>
                                    <option value="clerk">Clerk (Data Entry)</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="lab_engineer">Lab Engineer</option>
                                    <option value="super_admin">Super Admin</option>
                                    <option value="vc">Vice Chancellor</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">
                                    Department {isClerkRole && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    required={isClerkRole}
                                    value={formData.department_id}
                                    onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                >
                                    <option value="">{isClerkRole ? '— Select Department —' : 'No Department (All)'}</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Permission Toggles — only for program_admin */}
                        {isAdminRole && (
                            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <HiOutlineShieldCheck className="w-4 h-4 text-blue-600" />
                                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Admin Permissions</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.can_manage_restrictions}
                                            onChange={e => setFormData({ ...formData, can_manage_restrictions: e.target.checked })}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">Manage Restrictions</p>
                                            <p className="text-xs text-slate-400">Teacher availability & schedule config</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.can_delete_timetable}
                                            onChange={e => setFormData({ ...formData, can_delete_timetable: e.target.checked })}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">Delete Timetables</p>
                                            <p className="text-xs text-slate-400">Can delete generated timetables</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Clerk info box */}
                        {isClerkRole && (
                            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                                <p className="text-xs text-amber-700 font-medium">
                                    📋 Clerks can only manage <strong>Teachers</strong>, <strong>Subjects</strong>, and <strong>Assignments</strong> within their assigned department. They cannot generate or delete timetables.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            {editingUser && (
                                <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300 transition-colors">
                                    Cancel
                                </button>
                            )}
                            <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200">
                                {editingUser ? 'Update User' : 'Create User Account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="glass overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th onClick={() => handleSort('full_name')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                User {sortConfig.key === 'full_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => handleSort('role')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                Role {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => handleSort('department_name')} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                Department {sortConfig.key === 'department_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Permissions</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-400">Loading users...</td></tr>
                        ) : sortedUsers.length === 0 ? (
                            <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-400">No users found.</td></tr>
                        ) : sortedUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                                            {u.username.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{u.full_name}</div>
                                            <div className="text-xs text-slate-400">@{u.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${u.role === 'vc' ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white' :
                                        u.role === 'super_admin' ? 'bg-purple-100 text-purple-600' :
                                        u.role === 'program_admin' ? 'bg-blue-100 text-blue-600' :
                                            u.role === 'clerk' ? 'bg-amber-100 text-amber-600' :
                                                'bg-slate-100 text-slate-600'
                                        }`}>
                                        {u.role === 'vc' ? 'Vice Chancellor' : u.role.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-slate-600">
                                        {u.department_name || '—'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {u.role === 'vc' ? (
                                        <span className="text-xs text-violet-500 font-medium">University-Wide Access</span>
                                    ) : u.role === 'super_admin' ? (
                                        <span className="text-xs text-purple-500 font-medium">Full Access</span>
                                    ) : u.role === 'program_admin' ? (
                                        <div className="flex gap-1.5 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${u.can_manage_restrictions ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {u.can_manage_restrictions ? <HiOutlineCheck className="w-3 h-3" /> : <HiOutlineX className="w-3 h-3" />}
                                                Restrictions
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${u.can_delete_timetable ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {u.can_delete_timetable ? <HiOutlineCheck className="w-3 h-3" /> : <HiOutlineX className="w-3 h-3" />}
                                                Delete TT
                                            </span>
                                        </div>
                                    ) : u.role === 'clerk' ? (
                                        <span className="text-xs text-amber-500 font-medium">Data Entry Only</span>
                                    ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button
                                            onClick={() => startEdit(u)}
                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                        >
                                            <HiOutlinePencil className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
