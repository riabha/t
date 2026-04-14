import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { HiOutlineUpload, HiOutlineDownload, HiOutlinePlus, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi';

export default function StudentsPage() {
    const { user } = useAuth();
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [sections, setSections] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    
    const [formData, setFormData] = useState({
        roll_number: '',
        name: '',
        batch_id: '',
        section_id: '',
        department_id: user?.department_id || '',
        is_active: true
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [studentsRes, batchesRes, sectionsRes, deptsRes] = await Promise.all([
                api.get('/students/'),
                api.get('/departments/batches'),
                api.get('/departments/sections'),
                api.get('/departments/')
            ]);
            setStudents(studentsRes.data);
            setBatches(batchesRes.data);
            setSections(sectionsRes.data);
            setDepartments(deptsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStudent) {
                await api.put(`/students/${editingStudent.id}`, formData);
            } else {
                await api.post('/students/', formData);
            }
            setShowModal(false);
            setEditingStudent(null);
            setFormData({
                roll_number: '',
                name: '',
                batch_id: '',
                section_id: '',
                department_id: user?.department_id || '',
                is_active: true
            });
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to save student');
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            roll_number: student.roll_number,
            name: student.name,
            batch_id: student.batch_id,
            section_id: student.section_id || '',
            department_id: student.department_id,
            is_active: student.is_active
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this student?')) return;
        try {
            await api.delete(`/students/${id}`);
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to delete');
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) {
            alert('Please select a CSV file');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', uploadFile);
        
        try {
            const res = await api.post('/students/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(`Upload complete!\nCreated: ${res.data.created}\nSkipped: ${res.data.skipped}\n${res.data.errors.join('\n')}`);
            setUploadFile(null);
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Upload failed');
        }
    };

    const downloadTemplate = () => {
        window.open('/api/students/template/download', '_blank');
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Student Management</h1>
                <div className="flex gap-2">
                    <button onClick={downloadTemplate} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                        <HiOutlineDownload /> Download Template
                    </button>
                    <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 flex items-center gap-2">
                        <HiOutlinePlus /> Add Student
                    </button>
                </div>
            </div>

            {/* Upload Section */}
            <div className="glass p-4 flex items-center gap-4">
                <input type="file" accept=".csv" onChange={(e) => setUploadFile(e.target.files[0])} className="flex-1" />
                <button onClick={handleUpload} disabled={!uploadFile} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                    <HiOutlineUpload /> Upload CSV
                </button>
            </div>

            {/* Students Table */}
            <div className="glass overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Roll Number</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Batch</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Section</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Department</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {students.map(student => (
                            <tr key={student.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">{student.roll_number}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{student.name}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{student.batch_name}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{student.section_name || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{student.department_name}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${student.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {student.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleEdit(student)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg mr-2">
                                        <HiOutlinePencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(student.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">{editingStudent ? 'Edit Student' : 'Add Student'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Roll Number</label>
                                <input type="text" value={formData.roll_number} onChange={e => setFormData({...formData, roll_number: e.target.value})} disabled={!!editingStudent} required className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                                <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                    <option value="">Select</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Batch</label>
                                <select value={formData.batch_id} onChange={e => setFormData({...formData, batch_id: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                    <option value="">Select</option>
                                    {batches.filter(b => !formData.department_id || b.department_id === parseInt(formData.department_id)).map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Section (Optional)</label>
                                <select value={formData.section_id} onChange={e => setFormData({...formData, section_id: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                    <option value="">None</option>
                                    {sections.filter(s => !formData.batch_id || s.batch_id === parseInt(formData.batch_id)).map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} id="is_active" />
                                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</label>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => { setShowModal(false); setEditingStudent(null); }} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
