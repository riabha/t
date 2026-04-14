import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineUserAdd, HiOutlineUserRemove } from 'react-icons/hi';

export default function MakeupPage() {
    const { user } = useAuth();
    const [makeupClasses, setMakeupClasses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [students, setStudents] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [selectedMakeup, setSelectedMakeup] = useState(null);
    const [editingMakeup, setEditingMakeup] = useState(null);
    
    const [formData, setFormData] = useState({
        session_id: '',
        subject_id: '',
        teacher_id: '',
        room_id: '',
        department_id: user?.department_id || '',
        reason: '',
        original_date: '',
        is_lab: false,
        lab_engineer_id: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [makeupRes, sessionsRes, subjectsRes, teachersRes, roomsRes, studentsRes, deptsRes] = await Promise.all([
                api.get('/makeup/'),
                api.get('/assignments/sessions'),
                api.get('/subjects/'),
                api.get('/teachers/'),
                api.get('/rooms/'),
                api.get('/students/'),
                api.get('/departments/')
            ]);
            setMakeupClasses(makeupRes.data);
            setSessions(sessionsRes.data.filter(s => s.session_type === 'makeup'));
            setSubjects(subjectsRes.data);
            setTeachers(teachersRes.data);
            setRooms(roomsRes.data);
            setStudents(studentsRes.data);
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
            if (editingMakeup) {
                await api.put(`/makeup/${editingMakeup.id}`, formData);
            } else {
                await api.post('/makeup/', formData);
            }
            setShowModal(false);
            setEditingMakeup(null);
            resetForm();
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to save makeup class');
        }
    };

    const resetForm = () => {
        setFormData({
            session_id: '',
            subject_id: '',
            teacher_id: '',
            room_id: '',
            department_id: user?.department_id || '',
            reason: '',
            original_date: '',
            is_lab: false,
            lab_engineer_id: ''
        });
    };

    const handleEdit = (makeup) => {
        setEditingMakeup(makeup);
        setFormData({
            session_id: makeup.session_id,
            subject_id: makeup.subject_id,
            teacher_id: makeup.teacher_id,
            room_id: makeup.room_id || '',
            department_id: makeup.department_id,
            reason: makeup.reason || '',
            original_date: makeup.original_date || '',
            is_lab: makeup.is_lab,
            lab_engineer_id: makeup.lab_engineer_id || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this makeup class?')) return;
        try {
            await api.delete(`/makeup/${id}`);
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to delete');
        }
    };

    const handleEnroll = async (studentId) => {
        try {
            await api.post(`/makeup/${selectedMakeup.id}/enroll`, { student_id: studentId });
            loadData();
            setShowEnrollModal(false);
            setSelectedMakeup(null);
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to enroll student');
        }
    };

    const handleUnenroll = async (makeupId, studentId) => {
        if (!confirm('Remove this student from makeup class?')) return;
        try {
            await api.delete(`/makeup/${makeupId}/enroll/${studentId}`);
            loadData();
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to unenroll');
        }
    };

    const openEnrollModal = (makeup) => {
        setSelectedMakeup(makeup);
        setShowEnrollModal(true);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Makeup Classes</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage makeup classes for missed lectures</p>
                </div>
                <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 flex items-center gap-2">
                    <HiOutlinePlus /> Create Makeup Class
                </button>
            </div>

            {/* Makeup Classes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {makeupClasses.map(makeup => (
                    <div key={makeup.id} className="glass p-6 hover:shadow-xl transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800">{makeup.subject_code}</h3>
                                <p className="text-sm text-slate-600">{makeup.subject_name}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${makeup.is_lab ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {makeup.is_lab ? 'Lab' : 'Theory'}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center text-sm">
                                <span className="text-slate-500 w-24">Session:</span>
                                <span className="text-slate-800 font-medium">{makeup.session_name}</span>
                            </div>
                            <div className="flex items-center text-sm">
                                <span className="text-slate-500 w-24">Teacher:</span>
                                <span className="text-slate-800 font-medium">{makeup.teacher_name}</span>
                            </div>
                            {makeup.is_lab && makeup.lab_engineer_name && (
                                <div className="flex items-center text-sm">
                                    <span className="text-slate-500 w-24">Lab Eng:</span>
                                    <span className="text-slate-800 font-medium">{makeup.lab_engineer_name}</span>
                                </div>
                            )}
                            <div className="flex items-center text-sm">
                                <span className="text-slate-500 w-24">Room:</span>
                                <span className="text-slate-800 font-medium">{makeup.room_name || 'TBA'}</span>
                            </div>
                            {makeup.reason && (
                                <div className="flex items-start text-sm">
                                    <span className="text-slate-500 w-24">Reason:</span>
                                    <span className="text-slate-600 flex-1">{makeup.reason}</span>
                                </div>
                            )}
                            {makeup.original_date && (
                                <div className="flex items-center text-sm">
                                    <span className="text-slate-500 w-24">Missed:</span>
                                    <span className="text-slate-600">{new Date(makeup.original_date).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Enrolled Students */}
                        <div className="border-t border-slate-200 pt-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-700">Enrolled Students ({makeup.student_count})</span>
                                <button onClick={() => openEnrollModal(makeup)} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                                    <HiOutlineUserAdd className="w-4 h-4" /> Add
                                </button>
                            </div>
                            {makeup.students && makeup.students.length > 0 ? (
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {makeup.students.map(student => (
                                        <div key={student.id} className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1 rounded">
                                            <span className="text-slate-700">{student.roll_number} - {student.name}</span>
                                            <button onClick={() => handleUnenroll(makeup.id, student.id)} className="text-red-600 hover:text-red-700">
                                                <HiOutlineUserRemove className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No students enrolled yet</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button onClick={() => handleEdit(makeup)} className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1">
                                <HiOutlinePencil className="w-4 h-4" /> Edit
                            </button>
                            <button onClick={() => handleDelete(makeup.id)} className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center gap-1">
                                <HiOutlineTrash className="w-4 h-4" /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {makeupClasses.length === 0 && (
                <div className="glass p-12 text-center">
                    <p className="text-slate-500">No makeup classes yet. Create one to get started.</p>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">{editingMakeup ? 'Edit Makeup Class' : 'Create Makeup Class'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Session *</label>
                                    <select value={formData.session_id} onChange={e => setFormData({...formData, session_id: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                        <option value="">Select Session</option>
                                        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Department *</label>
                                    <select value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                        <option value="">Select</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Subject *</label>
                                <select value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                    <option value="">Select Subject</option>
                                    {subjects.filter(s => !formData.department_id || s.department_id === parseInt(formData.department_id)).map(s => <option key={s.id} value={s.id}>{s.code} - {s.full_name}</option>)}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <input type="checkbox" checked={formData.is_lab} onChange={e => setFormData({...formData, is_lab: e.target.checked})} id="is_lab" />
                                <label htmlFor="is_lab" className="text-sm font-medium text-slate-700">This is a Lab class</label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Teacher *</label>
                                    <select value={formData.teacher_id} onChange={e => setFormData({...formData, teacher_id: e.target.value})} required className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                        <option value="">Select Teacher</option>
                                        {teachers.filter(t => !t.is_lab_engineer).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                {formData.is_lab && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Lab Engineer</label>
                                        <select value={formData.lab_engineer_id} onChange={e => setFormData({...formData, lab_engineer_id: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                            <option value="">Select</option>
                                            {teachers.filter(t => t.is_lab_engineer).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Room</label>
                                <select value={formData.room_id} onChange={e => setFormData({...formData, room_id: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                    <option value="">Select Room</option>
                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Original Date (Missed Class)</label>
                                <input type="date" value={formData.original_date} onChange={e => setFormData({...formData, original_date: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Reason for Makeup</label>
                                <textarea value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} rows="3" placeholder="e.g., Teacher was sick, Holiday, etc." className="w-full px-4 py-2 border border-slate-300 rounded-lg"></textarea>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => { setShowModal(false); setEditingMakeup(null); resetForm(); }} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Enroll Student Modal */}
            {showEnrollModal && selectedMakeup && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Enroll Student</h2>
                        <p className="text-sm text-slate-600 mb-4">Select a student to enroll in {selectedMakeup.subject_code}</p>
                        
                        <div className="space-y-2">
                            {students
                                .filter(s => !selectedMakeup.students.some(enrolled => enrolled.id === s.id))
                                .filter(s => s.department_id === selectedMakeup.department_id)
                                .map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => handleEnroll(student.id)}
                                    className="w-full text-left px-4 py-3 border border-slate-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors"
                                >
                                    <div className="font-medium text-slate-800">{student.roll_number}</div>
                                    <div className="text-sm text-slate-600">{student.name}</div>
                                    <div className="text-xs text-slate-500">{student.batch_name} {student.section_name ? `- ${student.section_name}` : ''}</div>
                                </button>
                            ))}
                        </div>

                        {students.filter(s => !selectedMakeup.students.some(enrolled => enrolled.id === s.id) && s.department_id === selectedMakeup.department_id).length === 0 && (
                            <p className="text-sm text-slate-500 italic text-center py-8">No more students available to enroll</p>
                        )}

                        <button onClick={() => { setShowEnrollModal(false); setSelectedMakeup(null); }} className="w-full mt-4 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
