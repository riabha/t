import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { HiOutlineTrash } from 'react-icons/hi';

export default function ManualTimetablePage() {
    const { user } = useAuth();
    const [timetables, setTimetables] = useState([]);
    const [activeTT, setActiveTT] = useState(null);
    const [ttData, setTTData] = useState(null);
    const [sections, setSections] = useState([]);
    const [batches, setBatches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [draggedItem, setDraggedItem] = useState(null);
    const [assignments, setAssignments] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [ttRes, secRes, bRes, deptsRes, sessRes, subjRes, teachRes, roomRes] = await Promise.all([
            api.get('/timetable/list'),
            api.get('/departments/sections'),
            api.get('/departments/batches'),
            api.get('/departments/'),
            api.get('/assignments/sessions'),
            api.get('/subjects/'),
            api.get('/teachers/'),
            api.get('/rooms/')
        ]);
        
        console.log('=== INITIAL DATA LOAD ===');
        console.log('Timetables:', ttRes.data.length);
        console.log('Sections:', secRes.data.length);
        console.log('Batches:', bRes.data.length);
        console.log('Departments:', deptsRes.data.length);
        console.log('Sessions:', sessRes.data.length);
        console.log('Subjects:', subjRes.data.length);
        console.log('Teachers:', teachRes.data.length);
        console.log('Rooms:', roomRes.data.length);
        
        if (subjRes.data.length > 0) {
            console.log('Sample Subject:', subjRes.data[0]);
        }
        
        setTimetables(ttRes.data);
        setSections(secRes.data);
        setBatches(bRes.data);
        setDepartments(deptsRes.data);
        setSessions(sessRes.data);
        setSubjects(subjRes.data);
        setTeachers(teachRes.data);
        setRooms(roomRes.data);

        if (user?.department_id) {
            setSelectedDept(user.department_id.toString());
            console.log('Auto-selected dept:', user.department_id);
        }
        if (sessRes.data.length > 0) {
            setSelectedSessionId(sessRes.data[0].id.toString());
            console.log('Auto-selected session:', sessRes.data[0].id);
        }
    };


    useEffect(() => {
        if (selectedDept && timetables.length > 0) {
            const deptTTs = timetables.filter(t => t.department_id === parseInt(selectedDept) && t.status !== 'archived');
            if (deptTTs.length > 0) {
                loadTimetable(deptTTs[0].id);
            }
        }
    }, [selectedDept, timetables]);

    // Load assignments when session and batch change
    useEffect(() => {
        if (selectedSessionId && selectedBatchId) {
            loadAssignments();
        } else {
            setAssignments([]);
        }
    }, [selectedSessionId, selectedBatchId]);

    const loadAssignments = async () => {
        try {
            const res = await api.get(`/assignments/?session_id=${selectedSessionId}&batch_id=${selectedBatchId}`);
            console.log('=== ASSIGNMENTS LOADED ===');
            console.log('Session ID:', selectedSessionId);
            console.log('Batch ID:', selectedBatchId);
            console.log('Count:', res.data.length);
            if (res.data.length > 0) {
                console.log('Sample assignment:', res.data[0]);
                console.log('All section IDs in assignments:', [...new Set(res.data.map(a => a.section_id))]);
            }
            setAssignments(res.data);
        } catch (e) {
            console.error('Failed to load assignments:', e);
            setAssignments([]);
        }
    };

    const loadTimetable = async (id) => {
        setActiveTT(id);
        const res = await api.get(`/timetable/${id}`);
        setTTData(res.data);
    };

    const handleDrop = async (sectionId, day, slotIndex) => {
        if (!draggedItem || !activeTT) return;

        try {
            // Check for clashes FIRST
            const clashRes = await api.post('/timetable/check-clash', {
                timetable_id: activeTT,
                section_id: sectionId,
                day: day,
                slot_index: slotIndex,
                teacher_id: draggedItem.is_lab ? null : draggedItem.teacher_id,
                lab_engineer_id: draggedItem.is_lab ? draggedItem.lab_engineer_id : null,
                room_id: draggedItem.room_id,
                is_lab: draggedItem.is_lab
            });

            if (clashRes.data.has_clash) {
                const proceed = window.confirm(
                    `⚠️ CLASH DETECTED!\n\n${clashRes.data.message}\n\nDo you want to proceed anyway?`
                );
                if (!proceed) {
                    setDraggedItem(null);
                    return;
                }
            }
            
            // If dragging from another slot, delete it first
            if (draggedItem.from_slot_id) {
                await api.delete(`/timetable/slot/${draggedItem.from_slot_id}`);
            }
            
            await api.post('/timetable/add-slot', {
                timetable_id: activeTT,
                section_id: sectionId,
                day: day,
                slot_index: slotIndex,
                subject_id: draggedItem.subject_id,
                teacher_id: draggedItem.teacher_id,
                lab_engineer_id: draggedItem.lab_engineer_id,
                room_id: draggedItem.room_id,
                is_lab: draggedItem.is_lab
            });
            
            // Reload first to get fresh data
            await loadTimetable(activeTT);
            
            // Then manage breaks with fresh data
            setTimeout(() => manageBreaks(sectionId, day), 100);
            
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to add slot');
        }
        setDraggedItem(null);
    };

    const handleDeleteSlot = async (slotId) => {
        if (!window.confirm('Remove this slot?')) return;
        
        // Get slot info before deleting
        const slotToDelete = ttData.slots.find(s => s.id === slotId);
        
        try {
            await api.delete(`/timetable/slot/${slotId}`);
            
            // Reload first
            await loadTimetable(activeTT);
            
            // Then manage breaks with fresh data
            if (slotToDelete) {
                setTimeout(() => manageBreaks(slotToDelete.section_id, slotToDelete.day), 100);
            }
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed');
        }
    };
    
    // Manage break position based on morning labs
    const manageBreaks = async (sectionId, day) => {
        if (!ttData || !activeTT) return;
        
        // Get FRESH timetable data
        const freshData = await api.get(`/timetable/${activeTT}`);
        const freshSlots = freshData.data.slots || [];
        
        // Get current slots for this section/day (excluding breaks)
        const sectionSlots = freshSlots.filter(s => 
            s.section_id === sectionId && s.day === day && !s.is_break
        );
        
        // Check if there's a morning lab (slots 0, 1, 2)
        const hasMorningLab = sectionSlots.some(s => 
            s.is_lab && s.slot_index >= 0 && s.slot_index <= 2
        );
        
        // Determine target break position
        const targetBreakSlot = hasMorningLab ? 3 : (freshData.data.break_slot ?? 2);
        
        // Find existing break for this section/day
        const existingBreak = freshSlots.find(s => 
            s.section_id === sectionId && s.day === day && s.is_break
        );
        
        // If break exists at wrong position, delete it
        if (existingBreak && existingBreak.slot_index !== targetBreakSlot) {
            await api.delete(`/timetable/slot/${existingBreak.id}`);
        }
        
        // Check if target slot is occupied by a subject
        const targetSlotOccupied = sectionSlots.some(s => s.slot_index === targetBreakSlot);
        
        // Add break at correct position if not occupied and no break exists there
        if (!targetSlotOccupied && (!existingBreak || existingBreak.slot_index !== targetBreakSlot)) {
            try {
                await api.post('/timetable/add-break', {
                    timetable_id: activeTT,
                    section_id: sectionId,
                    day: day,
                    slot_index: targetBreakSlot
                });
            } catch (e) {
                console.error('Failed to add break:', e);
            }
        }
        
        // Final reload to show updated breaks
        await loadTimetable(activeTT);
    };

    // Get subjects for a specific section based on assignments ONLY
    const getSubjectsForSection = (sectionId) => {
        console.log('=== GET SUBJECTS FOR SECTION ===');
        console.log('Section ID:', sectionId);
        console.log('Total Assignments:', assignments.length);
        
        // IMPORTANT: Assignments have section_ids (array), not section_id (single)
        // Filter assignments where this section is in the section_ids array
        const sectionAssignments = assignments.filter(a => 
            a.section_ids && a.section_ids.includes(sectionId)
        );
        console.log('Section Assignments:', sectionAssignments.length);
        
        if (sectionAssignments.length === 0) {
            console.log('No assignments found for this section');
            return [];
        }
        
        // Get unique subject IDs from assignments
        const assignedSubjectIds = [...new Set(sectionAssignments.map(a => a.subject_id))];
        console.log('Assigned Subject IDs:', assignedSubjectIds);
        
        // Get subjects that match these IDs
        let availableSubjects = subjects.filter(s => assignedSubjectIds.includes(s.id));
        console.log('FINAL SUBJECTS:', availableSubjects.length);
        
        if (availableSubjects.length > 0) {
            console.log('Sample subject:', availableSubjects[0]);
        }
        
        return availableSubjects;
    };

    // Get sections for selected batch
    const batchSections = selectedBatchId
        ? sections.filter(s => s.batch_id === parseInt(selectedBatchId))
        : [];
    
    console.log('=== BATCH SECTIONS ===');
    console.log('Selected Batch ID:', selectedBatchId);
    console.log('Batch Sections:', batchSections.length);
    if (batchSections.length > 0) {
        console.log('Section IDs:', batchSections.map(s => s.id));
    }

    // Color palette
    const colors = [
        { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
        { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600' },
        { bg: 'bg-teal-500', text: 'text-white', border: 'border-teal-600' },
        { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-600' },
        { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
    ];

    const getColor = (code) => {
        const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };


    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">Manual Timetable Editor</h1>

            {/* Selectors */}
            <div className="glass p-5 flex gap-4 flex-wrap">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
                    <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
                        className="px-3 py-2 border rounded-lg">
                        <option value="">Select</option>
                        {departments.filter(d => !user?.department_id || d.id === user.department_id)
                            .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Session</label>
                    <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
                        className="px-3 py-2 border rounded-lg">
                        <option value="">Select</option>
                        {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Batch</label>
                    <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}
                        className="px-3 py-2 border rounded-lg">
                        <option value="">Select</option>
                        {batches.filter(b => !selectedDept || b.department_id === parseInt(selectedDept))
                            .map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                    </select>
                </div>
            </div>

            {/* Sections */}
            {ttData && selectedBatchId && batchSections.map(section => {
                const sectionSlots = ttData.slots?.filter(s => s.section_id === section.id) || [];
                
                return (
                    <div key={section.id} className="glass p-5">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold">{section.display_name}</h2>
                        </div>
                        
                        {/* Available Subjects */}
                        <div className="mb-4 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                            <p className="text-xs font-bold mb-3 text-slate-600">📚 AVAILABLE SUBJECTS (Drag to Grid)</p>
                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const sectionSubjects = getSubjectsForSection(section.id);
                                    
                                    if (sectionSubjects.length === 0) {
                                        return (
                                            <p className="text-sm text-slate-500 italic">
                                                No subjects assigned to this section
                                            </p>
                                        );
                                    }
                                    
                                    return sectionSubjects.map(subj => {
                                        // Get assignment info for this subject and section
                                        // IMPORTANT: section_ids is an array in assignments
                                        const assignment = assignments.find(a => 
                                            a.section_ids && a.section_ids.includes(section.id) && a.subject_id === subj.id
                                        );
                                        
                                        const color = getColor(subj.code);
                                        
                                        return (
                                            <div key={subj.id} className="flex gap-2">
                                                {/* Theory Block */}
                                                {subj.theory_credits > 0 && (
                                                    <div draggable
                                                        onDragStart={() => setDraggedItem({
                                                            subject_id: subj.id,
                                                            teacher_id: assignment?.teacher_id || subj.teacher_id || teachers[0]?.id || 1,
                                                            room_id: assignment?.room_id || subj.room_id || rooms[0]?.id || 1,
                                                            is_lab: false
                                                        })}
                                                        className={`px-3 py-2 ${color.bg} ${color.text} border-2 ${color.border} rounded-lg cursor-move font-bold text-sm hover:scale-105 transition shadow-sm`}>
                                                        {subj.code}
                                                    </div>
                                                )}
                                                
                                                {/* Lab Block */}
                                                {subj.lab_credits > 0 && (
                                                    <div draggable
                                                        onDragStart={() => setDraggedItem({
                                                            subject_id: subj.id,
                                                            teacher_id: assignment?.teacher_id || subj.teacher_id,
                                                            lab_engineer_id: assignment?.lab_engineer_id || subj.lab_engineer_id || assignment?.teacher_id || subj.teacher_id,
                                                            room_id: assignment?.lab_room_id || subj.lab_room_id || assignment?.room_id || subj.room_id || rooms[0]?.id || 1,
                                                            is_lab: true
                                                        })}
                                                        className={`px-3 py-2 ${color.bg} ${color.text} border-2 ${color.border} rounded-lg cursor-move font-bold text-sm hover:scale-105 transition shadow-sm`}>
                                                        {subj.code} (Pr)
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>


                        {/* Grid */}
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="border p-2 bg-slate-100 text-xs">Day</th>
                                    {[1,2,3,4,5,6,7,8].map(i => <th key={i} className="border p-2 bg-slate-100 text-xs">Slot {i}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {['Monday','Tuesday','Wednesday','Thursday','Friday'].map((day, dayIdx) => (
                                    <tr key={dayIdx}>
                                        <td className="border p-2 bg-slate-50 font-bold text-sm">{day}</td>
                                        {[0,1,2,3,4,5,6,7].map(slotIdx => {
                                            const slot = sectionSlots.find(s => s.day === dayIdx && s.slot_index === slotIdx);
                                            const color = slot?.subject_code ? getColor(slot.subject_code) : null;
                                            
                                            return (
                                                <td key={slotIdx}
                                                    onDragOver={e => e.preventDefault()}
                                                    onDrop={() => handleDrop(section.id, dayIdx, slotIdx)}
                                                    draggable={!!slot && !slot.is_break}
                                                    onDragStart={() => {
                                                        if (slot && !slot.is_break) {
                                                            setDraggedItem({
                                                                subject_id: slot.subject_id,
                                                                teacher_id: slot.teacher_id,
                                                                lab_engineer_id: slot.lab_engineer_id,
                                                                room_id: slot.room_id,
                                                                is_lab: slot.is_lab,
                                                                from_slot_id: slot.id
                                                            });
                                                        }
                                                    }}
                                                    className={`border p-2 min-w-[100px] h-16 transition group relative ${
                                                        slot?.is_break ? 'bg-amber-100 border-amber-300' :
                                                        slot && color ? `${color.bg} ${color.text} cursor-move` :
                                                        'bg-white hover:bg-slate-50 cursor-pointer'
                                                    }`}>
                                                    {slot?.is_break ? (
                                                        <div className="text-xs font-bold text-amber-700 text-center">BREAK</div>
                                                    ) : slot ? (
                                                        <>
                                                            <div className="text-xs font-bold">{slot.subject_code}{slot.is_lab ? ' (Pr)' : ''}</div>
                                                            <button onClick={() => handleDeleteSlot(slot.id)}
                                                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100">
                                                                <HiOutlineTrash className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-slate-300 text-center">Drop</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {!selectedBatchId && (
                <div className="glass p-12 text-center">
                    <p className="text-slate-500">Select Department, Session, and Batch to start</p>
                </div>
            )}
        </div>
    );
}
