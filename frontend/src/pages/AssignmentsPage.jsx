import React, { useState, useEffect } from 'react';
import api from '../api';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX, HiOutlineFolder, HiOutlineSelector, HiOutlineUpload, HiOutlineOfficeBuilding, HiOutlineAcademicCap, HiOutlineDownload } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function AssignmentsPage() {
    const { user } = useAuth();
    const canCombine = ['super_admin', 'program_admin'].includes(user?.role);
    const [assignments, setAssignments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [sections, setSections] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Sessions State
    const [sessions, setSessions] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [showNewSession, setShowNewSession] = useState(false);
    const [selectedSessionIds, setSelectedSessionIds] = useState([]);
    const [viewMode, setViewMode] = useState('teacher'); // 'teacher' or 'batch'
    const [showArchivedSessions, setShowArchivedSessions] = useState(false);
    const [showManageSessions, setShowManageSessions] = useState(false);
    const [newSessionPrefix, setNewSessionPrefix] = useState('EVEN');
    const [newSessionYear, setNewSessionYear] = useState(new Date().getFullYear());
    const [newSessionDeptId, setNewSessionDeptId] = useState('');

    // Assignment Specifics
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [showSlotManager, setShowSlotManager] = useState(false);
    const [activeSlot, setActiveSlot] = useState(null); // combination_id

    const [form, setForm] = useState({
        subject_id: '', teacher_id: '', lab_engineer_id: '', lab_room_id: '',
        batch_id: '', section_ids: [],
        dept_id: user?.department_id || '', // Subject Department
        batch_dept_id: user?.department_id || '', // Batch Department (New)
        selected_term: '',
        isJointClass: true,
        targetCombinationId: ''
    });
    const [showForm, setShowForm] = useState(false);
    const [filteredSections, setFilteredSections] = useState([]);
    const [showAllTerms, setShowAllTerms] = useState(false);
    const [teacherAssignments, setTeacherAssignments] = useState([]);
    const [showGlobalAssignments, setShowGlobalAssignments] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);

    // Import State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importBatchId, setImportBatchId] = useState('');
    const [importSessionId, setImportSessionId] = useState('');

    // Bulk Generation State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkSessionId, setBulkSessionId] = useState('');
    const [bulkSelections, setBulkSelections] = useState([]); // [{batch_id, semester}]
    const [bulkGenerating, setBulkGenerating] = useState(false);
    const [bulkSplitSections, setBulkSplitSections] = useState(true);
    const [selectedSectionsForAction, setSelectedSectionsForAction] = useState({}); // { rowKey: [{id, sid}] }
    const [superAdminDeptFilter, setSuperAdminDeptFilter] = useState(''); // Only for Super Admins
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [activeSubjectGroup, setActiveSubjectGroup] = useState(null); // {batch_id, subject_id, rowGroups}
    const [modalSelectedSections, setModalSelectedSections] = useState([]); // [{id, sid}]
    const [dragOverTarget, setDragOverTarget] = useState(null); // 'combined-rowKey' or 'split-rowKey'

    useEffect(() => {
        loadSessions();
        loadAll();
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

    const loadSessions = async (showArchived = showArchivedSessions) => {
        try {
            const res = await api.get('/assignments/sessions', { params: { show_archived: showArchived } });
            setSessions(res.data);
            if (res.data.length > 0 && !activeSession) {
                // Sessions are now university-wide, just use the first one
                // Department filtering is handled by the backend
                setActiveSession(res.data[0]);
            }
        } catch (e) { console.error('Failed to load sessions', e); }
    };

    const loadAll = async () => {
        const [bRes, sRes, subRes, tRes, rRes, dRes] = await Promise.all([
            api.get('/departments/batches'),
            api.get('/departments/sections'),
            api.get('/subjects/'),
            api.get('/teachers/'),
            api.get('/rooms/'),
            api.get('/departments/')
        ]);
        setBatches(bRes.data);
        setSections(sRes.data);
        setSubjects(subRes.data);
        setTeachers(tRes.data);
        setRooms(rRes.data);
        setDepartments(dRes.data);
    };

    useEffect(() => {
        if (activeSession) loadAssignments();
    }, [activeSession, showGlobalAssignments]);

    const loadAssignments = async () => {
        try {
            const aRes = await api.get(`/assignments/?session_id=${activeSession.id}`);
            let list = aRes.data;

            if (showGlobalAssignments) {
                // Fetch workload for all teachers in this session period across all departments
                const tIds = [...new Set(list.filter(a => a.teacher_id).map(a => a.teacher_id))];
                const globalRes = await Promise.all(tIds.map(id => api.get(`/assignments/?teacher_id=${id}`)));
                const allGlobal = globalRes.flatMap(r => r.data);

                // Merge and mark cross-dept ones (same session name matches across different departments)
                const currentIds = new Set(list.map(a => a.id));
                const crossDept = allGlobal.filter(ga => !currentIds.has(ga.id) && ga.session_name === activeSession.name).map(ga => ({ ...ga, isCrossDept: true }));
                list = [...list, ...crossDept];
            }

            setAssignments(list);
        } catch (e) { console.error('Failed to load assignments', e); }
    };

    const groupedAssignments = React.useMemo(() => {
        let list = [...assignments];

        if (viewMode === 'teacher') {
            // Teacher Grouping — merge standalone assignments by subject_id
            const slotMap = {};                    // combination_id → [assignments]
            const standaloneBySubject = {};        // `${teacher_id}_${subject_id}` → [assignments]

            list.forEach(a => {
                if (a.combination_id) {
                    if (!slotMap[a.combination_id]) slotMap[a.combination_id] = [];
                    slotMap[a.combination_id].push(a);
                } else {
                    // Group standalone by teacher + subject so same subject = one row
                    const tKey = a.teacher_id === null ? 'pending' : a.teacher_id;
                    const groupKey = `${tKey}_${a.subject_id}`;
                    if (!standaloneBySubject[groupKey]) standaloneBySubject[groupKey] = [];
                    standaloneBySubject[groupKey].push(a);
                }
            });

            const allSlots = [...Object.values(slotMap), ...Object.values(standaloneBySubject)];
            const teacherMap = {};
            allSlots.forEach(slot => {
                const first = slot[0];
                const tId = first.teacher_id;
                const tName = first.teacher_name || (tId === null ? "PENDING ASSIGNMENT" : `Teacher ID: ${tId}`);
                const key = tId === null ? 'pending' : tId;
                if (!teacherMap[key]) {
                    teacherMap[key] = { id: tId, name: tName, slots: [] };
                }
                teacherMap[key].slots.push(slot);
            });

            return Object.values(teacherMap).sort((a, b) => {
                if (a.id === null) return 1;
                if (b.id === null) return -1;
                return a.name.localeCompare(b.name);
            });
        } else {
            // Overhauled Batchwise Grouping (Unified Teacher-Subject Rows)
            const deptBatchMap = {};

            list.forEach(a => {
                const batchObj = batches.find(b => b.id === a.batch_id);
                // Apply Super Admin Department Filter if set
                if (user.role === 'super_admin' && superAdminDeptFilter && batchObj?.department_id !== parseInt(superAdminDeptFilter)) {
                    return;
                }

                const deptCode = batchObj?.department_code || (a.batch_name ? a.batch_name.replace(/[0-9]/g, '') : 'Other');
                const batchName = batchObj?.display_name || a.batch_name || `Batch ${a.batch_id}`;

                if (!deptBatchMap[deptCode]) {
                    deptBatchMap[deptCode] = { code: deptCode, batches: {} };
                }
                if (!deptBatchMap[deptCode].batches[a.batch_id]) {
                    deptBatchMap[deptCode].batches[a.batch_id] = { id: a.batch_id, name: batchName, rowGroups: [] };
                }

                // Group by Subject only (Master Row) - FORCE STRING KEY to prevent type-mismatch duplicates
                const sId = String(a.subject_id);
                const key = sId;

                let group = deptBatchMap[deptCode].batches[a.batch_id].rowGroups.find(rg => String(rg.subject_id) === sId);
                if (!group) {
                    group = {
                        key,
                        subject_id: a.subject_id,
                        subject_code: a.subject_code,
                        subject_name: a.subject_full_name,
                        assignments: []
                    };
                    deptBatchMap[deptCode].batches[a.batch_id].rowGroups.push(group);
                }
                group.assignments.push(a);
            });

            return Object.values(deptBatchMap).sort((a, b) => a.code.localeCompare(b.code));
        }
    }, [assignments, viewMode, batches, superAdminDeptFilter]);

    const handleToggleArchive = async (session) => {
        try {
            await api.put(`/assignments/sessions/${session.id}`, { is_archived: !session.is_archived });
            loadSessions();
        } catch (e) { alert('Failed to update session'); }
    };

    const handleCreateSession = async (e) => {
        e.preventDefault();
        try {
            const sessionName = `${newSessionPrefix}-${newSessionYear}`;
            const payload = { name: sessionName };
            // Sessions are now university-wide, no department_id needed
            const res = await api.post('/assignments/sessions', payload);
            setSessions([...sessions, res.data]);
            setActiveSession(res.data);
            setNewSessionDeptId('');
            setShowNewSession(false);
        } catch (e) { alert(e.response?.data?.detail || 'Failed to create session'); }
    };

    const handleDeleteSession = async (id) => {
        if (!confirm('Delete session and ALL its assignments?')) return;
        try {
            await api.delete(`/assignments/sessions/${id}`);
            const updated = sessions.filter(s => s.id !== id);
            setSessions(updated);
            if (activeSession?.id === id) setActiveSession(updated[0] || null);
        } catch (e) { alert('Failed to delete'); }
    }

    const handleBulkDeleteSessions = async () => {
        if (selectedSessionIds.length === 0) return;
        if (!confirm(`Delete ${selectedSessionIds.length} selected sessions and all their assignments?`)) return;
        try {
            await api.post('/assignments/sessions/bulk-delete', { ids: selectedSessionIds });
            const updated = sessions.filter(s => !selectedSessionIds.includes(s.id));
            setSessions(updated);
            setSelectedSessionIds([]);
            if (activeSession && selectedSessionIds.includes(activeSession.id)) {
                setActiveSession(updated[0] || null);
            }
        } catch (e) { alert('Bulk delete failed'); }
    };


    const handleUpdateAssignment = async (e) => {
        e.preventDefault();
        try {
            if (editingAssignment._isGroup && editingAssignment._assignedIds) {
                // Bulk update teacher for all assignments in the group
                await Promise.all(editingAssignment._assignedIds.map(id =>
                    api.put(`/assignments/${id}`, {
                        teacher_id: parseInt(editingAssignment.teacher_id),
                        lab_engineer_id: editingAssignment.lab_engineer_id ? parseInt(editingAssignment.lab_engineer_id) : null,
                        lab_room_id: editingAssignment.lab_room_id ? parseInt(editingAssignment.lab_room_id) : null,
                        section_ids: assignments.find(a => a.id === id)?.section_ids || []
                    })
                ));
            } else {
                await api.put(`/assignments/${editingAssignment.id}`, {
                    teacher_id: parseInt(editingAssignment.teacher_id),
                    lab_engineer_id: editingAssignment.lab_engineer_id ? parseInt(editingAssignment.lab_engineer_id) : null,
                    lab_room_id: editingAssignment.lab_room_id ? parseInt(editingAssignment.lab_room_id) : null,
                    section_ids: editingAssignment.section_ids,
                });
            }
            setEditingAssignment(null);
            loadAssignments();
        } catch (e) { alert('Update failed'); }
    };


    const handleUnmerge = async (asgnId) => {
        if (!confirm('Remove this assignment from the shared slot group?')) return;
        try {
            await api.post('/assignments/unmerge', null, { params: { assignment_id: asgnId } });
            loadAssignments();
        } catch (e) { alert('Unmerge failed'); }
    };

    const handleCombineSelected = async () => {
        if (selectedAssignmentIds.length < 2) {
            return alert('Please select at least two assignments to combine them into one shared slot.');
        }
        if (!confirm(`Combine ${selectedAssignmentIds.length} selected assignments into one shared slot?`)) return;

        try {
            // Take the first one as the base
            const [baseId, ...others] = selectedAssignmentIds;
            for (const targetId of others) {
                await api.post('/assignments/merge', null, {
                    params: { assignment_id: baseId, target_assignment_id: targetId }
                });
            }
            setSelectedAssignmentIds([]);
            loadAssignments();
            alert('Assignments combined successfully.');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to combine assignments');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedAssignmentIds.length === 0) return;
        if (!confirm(`Delete ${selectedAssignmentIds.length} selected assignments?`)) return;
        try {
            await api.post('/assignments/bulk-delete', { ids: selectedAssignmentIds });
            setSelectedAssignmentIds([]);
            await loadAssignments();
        } catch (err) {
            alert(err.response?.data?.detail || 'Bulk delete failed');
        }
    };

    const handleBulkDeleteByIds = async (ids) => {
        try {
            // Robust POST-based bulk delete
            await api.post('/assignments/bulk-delete', { ids });
            await loadAssignments();
            // Clear any selections from this row that might have been lost
            setSelectedSectionsForAction({});
        } catch (err) {
            alert(err.response?.data?.detail || 'Bulk delete failed');
        }
    };

    // ─── Drag & Drop Handlers ──────────────────────────────────────
    const onBadgeDragStart = (e, assignmentId, sectionId) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ assignmentId, sectionId }));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.4';
    };

    const onBadgeDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDragOverTarget(null);
    };

    const onColumnDragOver = (e, columnKey) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverTarget(columnKey);
    };

    const onColumnDragLeave = (e, columnKey) => {
        // Only reset if we leave the actual container (not a child element)
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverTarget(null);
        }
    };

    const onDropToCombined = async (e, groupAssignments) => {
        e.preventDefault();
        setDragOverTarget(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const draggedId = data.assignmentId;

            // Check if there's already a combined group in this row
            const existingCombined = groupAssignments.find(a => a.combination_id);

            if (existingCombined) {
                // Join the existing combination group
                await api.post('/assignments/mark-combined', null, {
                    params: { assignment_id: draggedId, join_combination_id: existingCombined.combination_id }
                });
            } else {
                // No combined group yet — mark this single badge as combined (creates new combination_id)
                await api.post('/assignments/mark-combined', null, {
                    params: { assignment_id: draggedId }
                });
            }
            loadAssignments();
        } catch (err) {
            console.error('Drop to combined failed:', err);
        }
    };

    const onDropToSplit = async (e) => {
        e.preventDefault();
        setDragOverTarget(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const draggedId = data.assignmentId;

            // Unmerge — clears combination_id from the dragged assignment and all siblings
            await api.post('/assignments/unmerge', null, {
                params: { assignment_id: draggedId }
            });
            loadAssignments();
        } catch (err) {
            console.error('Drop to split failed:', err);
        }
    };

    const handleDetachSection = async (a, sid) => {
        if (!confirm(`Detach section ${sections.find(s => s.id === sid)?.display_name} from this teacher? This will create a separate unassigned slot.`)) return;

        try {
            if (a.section_ids.length > 1) {
                const remainingSections = a.section_ids.filter(id => id !== sid);
                await api.put(`/assignments/${a.id}`, { section_ids: remainingSections });
                await api.post('/assignments/', {
                    session_id: activeSession.id,
                    subject_id: a.subject_id,
                    batch_id: a.batch_id,
                    teacher_id: null,
                    section_ids: [sid]
                });
            } else {
                await api.put(`/assignments/${a.id}`, {
                    teacher_id: null,
                    lab_engineer_id: null
                });
            }
            loadAssignments();
        } catch (err) {
            alert(err.response?.data?.detail || 'Detach failed');
        }
    };

    const handleTeacherChange = async (teacherId) => {
        setForm(f => ({ ...f, teacher_id: teacherId, targetCombinationId: '' }));
        if (!teacherId || !activeSession) {
            setTeacherAssignments([]);
            return;
        }
        try {
            const res = await api.get('/assignments/', {
                params: { teacher_id: teacherId, session_id: activeSession.id }
            });
            setTeacherAssignments(res.data);
        } catch (e) {
            console.error('Failed to fetch teacher assignments', e);
        }
    };

    const toggleSection = (secId) => {
        setForm(f => {
            const isSelected = f.section_ids.includes(secId);
            const nextSections = isSelected
                ? f.section_ids.filter(id => id !== secId)
                : [...f.section_ids, secId];

            return { ...f, section_ids: nextSections };
        });
    };

    const handleBatchDeptChange = async (deptId) => {
        setForm(f => ({ ...f, batch_dept_id: deptId, batch_id: '', section_ids: [] }));
        try {
            const res = await api.get('/departments/batches', { params: { department_id: deptId } });
            setBatches(res.data);
            setFilteredSections([]);
        } catch (e) { console.error('Failed to fetch batches for department', e); }
    };

    const handleBatchChange = async (batchId) => {
        setForm(f => ({ ...f, batch_id: batchId, section_ids: [] }));
        try {
            const res = await api.get('/departments/sections', { params: { batch_id: batchId } });
            setFilteredSections(res.data);
        } catch (e) {
            console.error('Failed to fetch sections for batch', e);
            // Fallback to local filtering if needed, but the backend fix allows explicit lookup
            setFilteredSections(sections.filter(s => s.batch_id === parseInt(batchId)));
        }
    };

    const handleBulkGenerate = async (e) => {
        e.preventDefault();
        if (!bulkSessionId) return alert('Please select a session');
        const validSelections = bulkSelections.filter(s => s.batch_id && s.semester);
        if (validSelections.length === 0) return alert('Please select a term for at least one batch');

        setBulkGenerating(true);
        try {
            const res = await api.post('/assignments/bulk-generate', {
                session_id: parseInt(bulkSessionId),
                split_sections: bulkSplitSections,
                batch_terms: validSelections.map(s => ({
                    batch_id: parseInt(s.batch_id),
                    semester: parseInt(s.semester)
                }))
            });
            alert(`Successfully created ${res.data.created_count} placeholder assignments.`);
            setShowBulkModal(false);
            loadAssignments();
        } catch (e) {
            alert(e.response?.data?.detail || 'Failed to bulk generate assignments');
        } finally {
            setBulkGenerating(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeSession) return alert('Please select or create an assignment session first');
        if (form.section_ids.length === 0) return alert('Please select at least one section');

        try {
            const payloadBase = {
                session_id: activeSession.id,
                subject_id: parseInt(form.subject_id),
                teacher_id: parseInt(form.teacher_id),
                lab_engineer_id: form.lab_engineer_id ? parseInt(form.lab_engineer_id) : null,
                lab_room_id: form.lab_room_id ? parseInt(form.lab_room_id) : null,
                batch_id: parseInt(form.batch_id),
            };

            let combinationId = form.targetCombinationId ? parseInt(form.targetCombinationId) : null;
            if (form.targetCombinationId) {
                const target = teacherAssignments.find(a => a.id === parseInt(form.targetCombinationId));
                if (target?.combination_id) combinationId = target.combination_id;
            }

            const requests = [];
            if (form.isJointClass) {
                // One assignment for all sections
                requests.push(api.post('/assignments/', {
                    ...payloadBase,
                    section_ids: form.section_ids,
                    combination_id: combinationId
                }));
            } else {
                // Separate assignment for each section
                form.section_ids.forEach(sid => {
                    requests.push(api.post('/assignments/', {
                        ...payloadBase,
                        section_ids: [sid],
                        combination_id: combinationId
                    }));
                });
            }

            const results = await Promise.all(requests);

            // If we joined an existing assignment that DIDN'T have a combination_id yet,
            // we should perform a merge on the backend to link them.
            if (form.targetCombinationId) {
                const target = teacherAssignments.find(a => a.id === parseInt(form.targetCombinationId));
                if (!target?.combination_id) {
                    for (const res of results) {
                        try {
                            await api.post('/assignments/merge', null, {
                                params: { assignment_id: target.id, target_assignment_id: res.data.id }
                            });
                        } catch (err) { console.error("Auto-merge failed", err); }
                    }
                }
            }

            loadAssignments();
            setShowForm(false);
            setForm({
                subject_id: '', teacher_id: '', lab_engineer_id: '', lab_room_id: '', batch_id: '', section_ids: [],
                dept_id: user?.department_id || '',
                batch_dept_id: user?.department_id || '',
                isJointClass: true, targetCombinationId: ''
            });
            setTeacherAssignments([]);
        } catch (e) { alert(e.response?.data?.detail || 'Error'); }
    };

    const handleSectionClick = async (a, sid, rowKey) => {
        // All badges follow the "Select then Act" workflow.
        // Clicking toggles selection state within the row.

        // Multi-Selection Logic for White badges -> turning them Orange
        setSelectedSectionsForAction(prev => {
            const current = prev[rowKey] || [];
            const isSelected = current.some(item => item.id === a.id && item.sid === sid);
            const next = isSelected
                ? current.filter(item => !(item.id === a.id && item.sid === sid))
                : [...current, { id: a.id, sid, subject_code: a.subject_code }];

            return { ...prev, [rowKey]: next };
        });
    };

    const handleCombineSelectedInRow = async (rowKey) => {
        const selected = selectedSectionsForAction[rowKey];
        if (!selected || selected.length < 2) return;

        try {
            // Sequence of merges: link all to the first one
            let baseId = selected[0].id;
            for (let i = 1; i < selected.length; i++) {
                await api.post('/assignments/merge', null, {
                    params: { assignment_id: baseId, target_assignment_id: selected[i].id }
                });
            }
            // Clear selection for this row after success
            setSelectedSectionsForAction(prev => {
                const next = { ...prev };
                delete next[rowKey];
                return next;
            });
            loadAssignments();
            alert('Sections combined successfully.');
        } catch (err) {
            alert('Combine failed: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleSplitSectionAction = async (item, rowKey) => {
        if (!confirm(`Split section into its own separate time slot?`)) return;
        try {
            const a = assignments.find(as => as.id === item.id);
            if (!a) return;

            if (a.section_ids.length > 1) {
                // Split: Keep teacher
                const remainingSections = a.section_ids.filter(sid => sid !== item.sid);
                await api.put(`/assignments/${a.id}`, { section_ids: remainingSections });
                await api.post('/assignments/', {
                    session_id: activeSession.id,
                    subject_id: a.subject_id,
                    batch_id: a.batch_id,
                    teacher_id: a.teacher_id,
                    lab_engineer_id: a.lab_engineer_id,
                    section_ids: [item.sid]
                });
            } else if (a.combination_id) {
                await api.post('/assignments/unmerge', null, { params: { assignment_id: a.id } });
            }

            setSelectedSectionsForAction(prev => {
                const n = { ...prev };
                delete n[rowKey];
                return n;
            });
            loadAssignments();
        } catch (err) {
            alert('Split failed');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this assignment?')) return;
        await api.delete(`/assignments/${id}`);
        loadAssignments();
    };

    const facultyTeachers = teachers
        .filter(t => !t.is_lab_engineer && (user.role === 'super_admin' || t.department_id === user.department_id || (t.engaged_department_ids || []).includes(user.department_id)))
        .map(t => ({ ...t, display_full_name: `${t.name}${t.department_id !== user.department_id ? ' (Engaged)' : ''}` }));

    const labEngineers = teachers
        .filter(t => t.is_lab_engineer && (user.role === 'super_admin' || t.department_id === user.department_id || (t.engaged_department_ids || []).includes(user.department_id)))
        .map(t => ({ ...t, display_full_name: `${t.name}${t.department_id !== user.department_id ? ' (Engaged)' : ''}` }));

    // Combined list for lab engineer selection: lab engineers first, then teachers
    const labEngineerOptions = [
        ...labEngineers,
        ...facultyTeachers
    ];

    const handleParseFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setImportLoading(true);
        try {
            const res = await api.post('/assignments/parse-import', formData);
            setImportData(res.data);
            setImportBatchId(activeSession?.batch_id || ''); // This might need a separate selector
            setImportSessionId(activeSession?.id || '');
            setShowImportModal(true);
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to parse file');
        } finally {
            setImportLoading(false);
            e.target.value = '';
        }
    };

    const handleFinalizeImport = async () => {
        if (!importSessionId || !importBatchId) {
            alert('Please select a session and batch.');
            return;
        }

        try {
            await api.post('/assignments/bulk-import', {
                session_id: parseInt(importSessionId),
                batch_id: parseInt(importBatchId),
                assignments: importData
            });
            setShowImportModal(false);
            loadAssignments();
            alert('Assignments imported successfully!');
        } catch (err) {
            alert(err.response?.data?.detail || 'Import failed');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Assignments</h1>
                    <p className="text-sm text-slate-500">Link subjects to teachers & sections for specific sessions</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Session Selector */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm">
                        <HiOutlineFolder className="w-4 h-4 text-slate-400" />
                        <select
                            value={activeSession?.id || ''}
                            onChange={e => setActiveSession(sessions.find(s => s.id === parseInt(e.target.value)))}
                            className="bg-transparent text-sm font-medium text-slate-700 outline-none"
                        >
                            <option value="">Select Session</option>
                            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button onClick={() => setShowManageSessions(true)} className="ml-1 text-slate-400 hover:text-primary-600 transition-colors" title="Manage Sessions">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Manage All</span>
                        </button>
                    </div>

                    <button onClick={() => setShowNewSession(true)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
                        <HiOutlinePlus className="w-5 h-5" />
                    </button>

                    {/* Bulk Create Modal */}
                    {showBulkModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                            <div className="glass max-w-lg w-full p-0 animate-in zoom-in-95 duration-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800">Bulk Create Assignments</h2>
                                        <p className="text-xs text-slate-500">Generate placeholders for each batch & term</p>
                                    </div>
                                    <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                                        <HiOutlineX className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleBulkGenerate} className="p-6 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session</label>
                                        <select
                                            required
                                            value={bulkSessionId}
                                            onChange={e => setBulkSessionId(e.target.value)}
                                            className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="">Select Session</option>
                                            {sessions.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Batches & Terms</label>
                                        <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden">
                                            <div className="max-h-60 overflow-y-auto">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left font-bold text-slate-500">Batch</th>
                                                            <th className="px-3 py-2 text-left font-bold text-slate-500">Term (Semester)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {batches.filter(b => user.role === 'super_admin' || b.department_id === user.department_id).map(b => {
                                                            const selection = bulkSelections.find(s => s.batch_id === b.id);
                                                            return (
                                                                <tr key={b.id} className={selection ? 'bg-primary-50/30' : ''}>
                                                                    <td className="px-3 py-2">
                                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!selection}
                                                                                onChange={() => {
                                                                                    if (selection) {
                                                                                        setBulkSelections(prev => prev.filter(s => s.batch_id !== b.id));
                                                                                    } else {
                                                                                        setBulkSelections(prev => [...prev, { batch_id: b.id, semester: '' }]);
                                                                                    }
                                                                                }}
                                                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                                            />
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-medium text-slate-700">{b.display_name}</span>
                                                                                {b.morning_lab_mode && (
                                                                                    <span
                                                                                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${getModeColor(b.morning_lab_mode)}`}
                                                                                        title={getModeTooltip(b)}
                                                                                    >
                                                                                        {b.morning_lab_mode === 'strict' && '🌅'}
                                                                                        {b.morning_lab_mode === 'prefer' && '☀️'}
                                                                                        {b.morning_lab_mode === 'count' && `📊${b.morning_lab_count || 0}`}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </label>
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <select
                                                                            disabled={!selection}
                                                                            value={selection?.semester || ''}
                                                                            onChange={e => {
                                                                                setBulkSelections(prev => prev.map(s => s.batch_id === b.id ? { ...s, semester: e.target.value } : s));
                                                                            }}
                                                                            className={`w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 ${!selection ? 'opacity-50' : ''}`}
                                                                        >
                                                                            <option value="">Term...</option>
                                                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(t => <option key={t} value={t}>Term {t}</option>)}
                                                                        </select>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-1">
                                        <input
                                            type="checkbox"
                                            id="splitSections"
                                            checked={bulkSplitSections}
                                            onChange={e => setBulkSplitSections(e.target.checked)}
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <label htmlFor="splitSections" className="text-xs font-bold text-slate-600 cursor-pointer">
                                            Split sections into separate assignments
                                        </label>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">Cancel</button>
                                        <button type="submit" disabled={bulkGenerating} className="flex-[2] py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                                            {bulkGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <HiOutlinePlus className="w-4 h-4" />}
                                            {bulkGenerating ? 'Generating...' : 'Generate Assignments'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Subject Assignment Modal (The Master Manager) */}
                    {showSubjectModal && activeSubjectGroup && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
                            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-primary-50 to-white">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg text-white">
                                            <HiOutlineAcademicCap className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Edit Subject Assignments</h2>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                <span className="font-semibold">{batches.find(b => b.id === activeSubjectGroup.batch_id)?.display_name}</span> •
                                                <span className="font-semibold ml-1">{subjects.find(s => s.id === activeSubjectGroup.subject_id)?.full_name}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setShowSubjectModal(false); setModalSelectedSections([]); }} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-slate-600">
                                        <HiOutlineX className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-3 overflow-y-auto bg-slate-50/30 flex-1">
                                    {(() => {
                                        const allAssignments = activeSubjectGroup.assignments || (activeSubjectGroup.rows || []).flatMap(rg => rg.assignments || []);
                                        const rowSections = allAssignments.flatMap(a => (a.section_ids || []).map(sid => ({ sid, a })));

                                        return rowSections.map(({ sid, a }) => {
                                            // Get the current state of this assignment (with user's changes)
                                            const currentAssignment = assignments.find(item => item.id === a.id) || a;
                                            const isCombined = currentAssignment.combination_id || currentAssignment.section_ids.length > 1;
                                            const sectionName = sections.find(s => s.id === sid)?.display_name || sid;

                                            return (
                                                <div key={`${a.id}-${sid}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all">
                                                    <div className="flex items-start justify-between gap-4">
                                                        {/* Section Badge */}
                                                        <div className="flex-shrink-0">
                                                            <div className="w-16 h-16 flex items-center justify-center bg-primary-100 text-primary-700 font-black text-lg rounded-xl border-2 border-primary-200">
                                                                {sectionName}
                                                            </div>
                                                            {isCombined && (
                                                                <div className="mt-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded text-center">
                                                                    SHARED
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Assignment Fields */}
                                                        <div className="flex-1 grid grid-cols-4 gap-3">
                                                            {/* Teacher */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Teacher</label>
                                                                <select
                                                                    value={currentAssignment.teacher_id || ''}
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value ? parseInt(e.target.value) : null;
                                                                        setAssignments(prev => prev.map(item =>
                                                                            item.id === currentAssignment.id ? { ...item, teacher_id: newVal } : item
                                                                        ));
                                                                    }}
                                                                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                                                >
                                                                    <option value="">Select Teacher</option>
                                                                    {facultyTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                    {labEngineers.length > 0 && <option disabled style={{ fontWeight: 'bold' }}>── Lab Engineers ──</option>}
                                                                    {labEngineers.map(t => <option key={`le-${t.id}`} value={t.id}>{t.name}</option>)}
                                                                </select>
                                                            </div>

                                                            {/* Lab Engineer */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Lab Engineer</label>
                                                                <select
                                                                    value={currentAssignment.lab_engineer_id || ''}
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value ? parseInt(e.target.value) : null;
                                                                        setAssignments(prev => prev.map(item =>
                                                                            item.id === currentAssignment.id ? { ...item, lab_engineer_id: newVal } : item
                                                                        ));
                                                                    }}
                                                                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                                                >
                                                                    <option value="">None</option>
                                                                    {labEngineers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                                    {facultyTeachers.length > 0 && <option disabled style={{ fontWeight: 'bold' }}>── Teachers ──</option>}
                                                                    {facultyTeachers.map(t => <option key={`t-${t.id}`} value={t.id}>{t.name}</option>)}
                                                                </select>
                                                            </div>

                                                            {/* Lab Room */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Lab Room</label>
                                                                <select
                                                                    value={currentAssignment.lab_room_id || ''}
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value ? parseInt(e.target.value) : null;
                                                                        setAssignments(prev => prev.map(item =>
                                                                            item.id === currentAssignment.id ? { ...item, lab_room_id: newVal } : item
                                                                        ));
                                                                    }}
                                                                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                                                >
                                                                    <option value="">None</option>
                                                                    {rooms.filter(r => r.is_lab).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                                </select>
                                                                <div className="text-[8px] text-slate-400 mt-1">{rooms.filter(r => r.is_lab).length} labs available</div>
                                                            </div>

                                                            {/* Consecutive Lectures */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Consecutive</label>
                                                                <select
                                                                    value={currentAssignment.consecutive_lectures || 0}
                                                                    onChange={(e) => {
                                                                        const newVal = parseInt(e.target.value);
                                                                        setAssignments(prev => prev.map(item =>
                                                                            item.id === currentAssignment.id ? { ...item, consecutive_lectures: newVal } : item
                                                                        ));
                                                                    }}
                                                                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                                                                >
                                                                    <option value="0">None</option>
                                                                    <option value="2">2 Hours</option>
                                                                    <option value="3">3 Hours</option>
                                                                </select>
                                                                <div className="text-[8px] text-slate-400 mt-1">Back-to-back slots</div>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        {isCombined && (
                                                            <button
                                                                onClick={() => handleSplitSectionAction({ id: currentAssignment.id, sid }, activeSubjectGroup.key || (activeSubjectGroup.rows && activeSubjectGroup.rows[0]?.key))}
                                                                className="flex-shrink-0 p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-all"
                                                                title="Split from shared slot"
                                                            >
                                                                <HiOutlineX className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>

                                {/* Footer with Save Button */}
                                <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between">
                                    <p className="text-xs text-slate-400">Make changes above and click Save to apply</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setShowSubjectModal(false); setModalSelectedSections([]); loadAssignments(); }}
                                            className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    // Get the assignment IDs from the modal
                                                    const allAssignments = activeSubjectGroup.assignments || (activeSubjectGroup.rows || []).flatMap(rg => rg.assignments || []);
                                                    const assignmentIds = allAssignments.map(a => a.id);

                                                    // Get the current state of these assignments (with user's changes)
                                                    const assignmentsToSave = assignments.filter(a => assignmentIds.includes(a.id));

                                                    await Promise.all(assignmentsToSave.map(a =>
                                                        api.put(`/assignments/${a.id}`, {
                                                            teacher_id: a.teacher_id,
                                                            lab_engineer_id: a.lab_engineer_id || null,
                                                            lab_room_id: a.lab_room_id || null,
                                                            section_ids: a.section_ids,
                                                            consecutive_lectures: a.consecutive_lectures || 0
                                                        })
                                                    ));
                                                    setShowSubjectModal(false);
                                                    setModalSelectedSections([]);
                                                    loadAssignments();
                                                    alert('All changes saved successfully!');
                                                } catch (err) {
                                                    alert('Failed to save changes: ' + (err.response?.data?.detail || err.message));
                                                }
                                            }}
                                            className="px-6 py-2.5 gradient-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-500/25 hover:opacity-90 transition-all"
                                        >
                                            Save All Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('teacher')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'teacher' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Teacher
                        </button>
                        <button
                            onClick={() => setViewMode('batch')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'batch' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Batch
                        </button>
                    </div>

                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-4 py-2 gradient-accent rounded-xl text-white
                                       text-sm font-medium hover:opacity-90 transition-opacity shadow-md shadow-primary-500/20">
                        <HiOutlinePlus className="w-4 h-4" /> New Assignment
                    </button>

                    <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl shadow-sm cursor-pointer hover:border-primary-300 transition-all select-none"
                        onClick={() => setShowGlobalAssignments(!showGlobalAssignments)}
                        title="Show teacher's workload across all departments">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${showGlobalAssignments ? 'bg-indigo-500 border-indigo-500' : 'bg-slate-50 border-slate-300'}`}>
                            {showGlobalAssignments && <div className="w-1 h-1 bg-white rounded-full" />}
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Global Depth</span>
                    </div>

                    {/* Bulk Generator UI */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setBulkSessionId(activeSession?.id || '');
                                setBulkSelections([]);
                                setShowBulkModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 border border-primary-700 rounded-xl text-white
                                           text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                            title="Bulk Create Placeholder Assignments"
                        >
                            <HiOutlinePlus className="w-4 h-4" />
                            <span className="hidden sm:inline">Bulk Create</span>
                        </button>
                    </div>

                    {/* Import Button */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                try {
                                    const res = await api.get('/assignments/template', { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', 'assignment_template.csv');
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                } catch (e) { alert('Failed to download template'); }
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                            title="Download CSV Template"
                        >
                            <HiOutlineDownload className="w-4 h-4" />
                            <span className="hidden sm:inline">Template</span>
                        </button>

                        {/* Dept Filter for Super Admin */}
                        {user.role === 'super_admin' && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter Dept:</span>
                                <select
                                    value={superAdminDeptFilter}
                                    onChange={e => setSuperAdminDeptFilter(e.target.value)}
                                    className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                                >
                                    <option value="">All Departments</option>
                                    {[...new Set(batches.map(b => b.department_id))].map(id => {
                                        const deptName = batches.find(b => b.department_id === id)?.department_name || `Dept ${id}`;
                                        return <option key={id} value={id}>{deptName}</option>
                                    })}
                                </select>
                            </div>
                        )}

                        <label className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600
                                           text-sm font-medium hover:bg-indigo-100 transition-colors cursor-pointer shadow-sm">
                            <HiOutlineUpload className="w-4 h-4" /> Import
                            <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.csv" onChange={handleParseFile} />
                        </label>
                    </div>
                </div>
            </div>

            {/* Manage Sessions Modal */}
            {
                showManageSessions && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                        <div className="glass max-w-lg w-full p-0 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Manage Sessions</h2>
                                    <p className="text-xs text-slate-500">List and delete assignment sessions in bulk</p>
                                </div>
                                <button onClick={() => setShowManageSessions(false)} className="text-slate-400 hover:text-slate-600">
                                    <HiOutlineX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={showArchivedSessions}
                                        onChange={e => {
                                            setShowArchivedSessions(e.target.checked);
                                            loadSessions(e.target.checked);
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-primary-600"
                                    />
                                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Show Archived Sessions</span>
                                </label>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-2">
                                {sessions.length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 italic">No sessions found.</p>
                                ) : sessions.map(s => (
                                    <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-primary-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedSessionIds.includes(s.id)}
                                            onChange={e => {
                                                setSelectedSessionIds(prev =>
                                                    e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                                                );
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 text-primary-600"
                                        />
                                        <div className={`flex-1 ${s.is_archived ? 'opacity-50' : ''}`}>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                                                {s.is_archived && <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-1 rounded uppercase">Archived</span>}
                                            </div>
                                            <p className="text-[10px] text-slate-400">ID: {s.id}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleToggleArchive(s)}
                                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${s.is_archived ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                                            >
                                                {s.is_archived ? 'Unarchive' : 'Archive'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSession(s.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500">
                                    {selectedSessionIds.length} Selected
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowManageSessions(false)}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50"
                                    >
                                        Close
                                    </button>
                                    <button
                                        disabled={selectedSessionIds.length === 0}
                                        onClick={handleBulkDeleteSessions}
                                        className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
                                    >
                                        Delete Selected
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* New Session Modal */}
            {/* Edit Assignment Modal */}
            {
                editingAssignment && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                        <div className="glass max-w-2xl w-full p-6 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h1 className="text-xl font-bold text-slate-800">Edit Assignment</h1>
                                    <p className="text-sm text-slate-500">Subject: <span className="font-bold text-primary-600">{editingAssignment.subject_code}</span></p>
                                </div>
                                <button onClick={() => setEditingAssignment(null)} className="text-slate-400 hover:text-slate-600">
                                    <HiOutlineX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdateAssignment} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Primary Teacher</label>
                                        <select
                                            value={editingAssignment.teacher_id}
                                            onChange={e => setEditingAssignment({ ...editingAssignment, teacher_id: e.target.value })}
                                            className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="">Select Teacher</option>
                                            {facultyTeachers.map(t => (
                                                <option key={t.id} value={t.id}>{t.display_full_name} ({t.department_name})</option>
                                            ))}
                                            {labEngineers.length > 0 && <option disabled style={{ fontWeight: 'bold' }}>── Lab Engineers ──</option>}
                                            {labEngineers.map(t => (
                                                <option key={`le-${t.id}`} value={t.id}>{t.display_full_name} ({t.department_name})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Lab Engineer (Optional)</label>
                                        <select
                                            value={editingAssignment.lab_engineer_id || ''}
                                            onChange={e => setEditingAssignment({ ...editingAssignment, lab_engineer_id: e.target.value })}
                                            className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="">None</option>
                                            {labEngineers.map(t => (
                                                <option key={t.id} value={t.id}>{t.display_full_name} ({t.department_name})</option>
                                            ))}
                                            {facultyTeachers.length > 0 && <option disabled style={{ fontWeight: 'bold' }}>── Teachers ──</option>}
                                            {facultyTeachers.map(t => (
                                                <option key={`t-${t.id}`} value={t.id}>{t.display_full_name} ({t.department_name})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Lab Room (Optional)</label>
                                    <select
                                        value={editingAssignment.lab_room_id || ''}
                                        onChange={e => setEditingAssignment({ ...editingAssignment, lab_room_id: e.target.value })}
                                        className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                    >
                                        <option value="">None</option>
                                        {rooms.filter(r => r.is_lab).map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Sections</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                        {sections.filter(s => s.batch_id === editingAssignment.batch_id).map(s => {
                                            const isSelected = editingAssignment.section_ids.includes(s.id);
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = isSelected
                                                            ? editingAssignment.section_ids.filter(id => id !== s.id)
                                                            : [...editingAssignment.section_ids, s.id];
                                                        setEditingAssignment({ ...editingAssignment, section_ids: next });
                                                    }}
                                                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected
                                                        ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {s.display_name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setEditingAssignment(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-2.5 gradient-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-500/25">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                showNewSession && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                        <div className="glass max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Session</h2>
                            <form onSubmit={handleCreateSession} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Prefix</label>
                                        <select
                                            required
                                            value={newSessionPrefix}
                                            onChange={e => setNewSessionPrefix(e.target.value)}
                                            className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="EVEN">EVEN</option>
                                            <option value="ODD">ODD</option>
                                            <option value="MakeUp">MakeUp</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Year</label>
                                        <select
                                            required
                                            value={newSessionYear}
                                            onChange={e => setNewSessionYear(parseInt(e.target.value))}
                                            className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i).map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {user.role === 'super_admin' && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase ml-1">Department</label>
                                        <select
                                            required
                                            value={newSessionDeptId}
                                            onChange={e => setNewSessionDeptId(e.target.value)}
                                            className="w-full px-4 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => { setShowNewSession(false); setNewSessionDeptId(''); }} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">Cancel</button>
                                    <button type="submit" className="flex-1 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Create</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }


            {
                showForm && (
                    <div className="glass p-5 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-slate-800">Create Assignment for <span className="text-primary-600">{activeSession?.name}</span></h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Batch Dept</label>
                                    <select
                                        disabled={user?.role !== 'super_admin'}
                                        value={form.batch_dept_id}
                                        onChange={e => handleBatchDeptChange(e.target.value)} required
                                        className={`px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none ring-1 ring-primary-500/10 ${user?.role !== 'super_admin' ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                        <option value="">Select Dept</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Batch</label>
                                    <select value={form.batch_id} onChange={e => handleBatchChange(e.target.value)} required
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none">
                                        <option value="">Select Batch</option>
                                        {batches.filter(b => b.department_id === parseInt(form.batch_dept_id)).map(b => (
                                            <option key={b.id} value={b.id}>{b.display_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Subject Dept</label>
                                    <select value={form.dept_id} onChange={e => setForm(f => ({ ...f, dept_id: e.target.value, subject_id: '', teacher_id: '', lab_engineer_id: '' }))} required
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none ring-1 ring-primary-500/10">
                                        <option value="">Select Dept</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Choice of Term</label>
                                    <select
                                        value={form.selected_term}
                                        onChange={e => setForm(f => ({ ...f, selected_term: e.target.value }))}
                                        className="px-3 py-2 bg-white border border-primary-200 rounded-xl text-slate-800 text-sm focus:outline-none ring-2 ring-primary-500/5"
                                    >
                                        <option value="">Select Term (Sem)</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                            <option key={s} value={s}>{s === 1 ? '1st' : s === 2 ? '2nd' : s === 3 ? '3rd' : `${s}th`} Term</option>
                                        ))}
                                        <option value="all">Show All at Once</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Subject</label>
                                    <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} required
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none">
                                        <option value="">Select Subject</option>
                                        {(() => {
                                            const selectedBatch = batches.find(b => b.id === parseInt(form.batch_id));
                                            const batchSemester = selectedBatch?.semester;

                                            // Effective semester filter: form.selected_term overrides batch semester
                                            const semesterFilter = form.selected_term === 'all'
                                                ? null
                                                : (form.selected_term ? parseInt(form.selected_term) : batchSemester);

                                            return subjects
                                                .filter(s => s.department_id === parseInt(form.dept_id))
                                                .filter(s => !semesterFilter || s.semester === semesterFilter)
                                                .map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.code} — {s.full_name} {s.semester ? `(Sem ${s.semester})` : ''}
                                                    </option>
                                                ));
                                        })()}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Teacher</label>
                                    <select value={form.teacher_id} onChange={e => handleTeacherChange(e.target.value)} required
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none ring-1 ring-primary-500/20">
                                        <option value="">Select Teacher</option>
                                        {facultyTeachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.display_full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {canCombine && form.teacher_id && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary-50/30 border border-primary-100 rounded-2xl animate-in fade-in slide-in-from-left-2 transition-all">
                                    <div>
                                        <label className="text-[10px] font-black text-primary-600 uppercase tracking-widest block mb-2">Proactive Merging</label>
                                        <select
                                            value={form.targetCombinationId}
                                            onChange={e => setForm(f => ({ ...f, targetCombinationId: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white border border-primary-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="">+ Join Existing Time Slot (Optional)</option>
                                            {teacherAssignments.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    Join {a.subject_code} ({a.batch_id ? batches.find(b => b.id === a.batch_id)?.display_name : 'N/A'})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-primary-400 mt-2 italic px-1">
                                            * Select an assignment to ensure this new one shares the same time slot on the timetable.
                                        </p>
                                    </div>
                                    <div className="flex flex-col justify-center border-l border-primary-100 pl-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Current Assignments</span>
                                            <span className="text-[10px] font-black text-primary-600">{teacherAssignments.length} Found</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {teacherAssignments.map(a => (
                                                <span key={a.id} className="px-2 py-0.5 bg-white border border-primary-100 text-primary-600 text-[9px] font-bold rounded-lg uppercase">
                                                    {a.subject_code}
                                                </span>
                                            ))}
                                            {teacherAssignments.length === 0 && <span className="text-[10px] text-slate-400 italic">No assignments yet in this session.</span>}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lab Engineer</label>
                                    <select value={form.lab_engineer_id} onChange={e => setForm(f => ({ ...f, lab_engineer_id: e.target.value }))}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none">
                                        <option value="">Lab Engineer (optional - from same dept)</option>
                                        {labEngineers.map(t => (
                                            <option key={t.id} value={t.id}>{t.display_full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lab Room</label>
                                    <select value={form.lab_room_id} onChange={e => setForm(f => ({ ...f, lab_room_id: e.target.value }))}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none">
                                        <option value="">Select Lab (optional)</option>
                                        {rooms.filter(r => r.is_lab).map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {canCombine && form.section_ids.length > 1 && (
                                    <div className="flex items-center justify-between px-4 py-2 bg-amber-50 rounded-xl border border-amber-200 shadow-sm transition-all animate-in zoom-in-95">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineSelector className="w-4 h-4 text-amber-600" />
                                            <span className="text-xs font-bold text-amber-700 uppercase tracking-tight">Combine into Joint Slot</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.isJointClass}
                                                onChange={e => setForm(f => ({ ...f, isJointClass: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                        </label>
                                    </div>
                                )}
                            </div>
                            {filteredSections.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Select Sections</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {filteredSections.map(s => {
                                            const isSelected = form.section_ids.includes(s.id);
                                            return (
                                                <button key={s.id} type="button" onClick={() => toggleSection(s.id)}
                                                    className={`px-3 py-2 text-sm font-semibold rounded-xl border transition-all flex items-center justify-between ${isSelected
                                                        ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                                                        }`}>
                                                    {s.display_name}
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-200'}`}>
                                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 pt-2">
                                <button type="submit" className="px-6 py-2.5 gradient-accent text-white rounded-xl text-sm font-bold
                                       hover:opacity-90 shadow-lg shadow-primary-500/25 transition-all active:scale-95">
                                    Set Assignments
                                </button>
                                {form.section_ids.length > 1 && (
                                    <div className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 animate-pulse">
                                        {form.section_ids.length} sections will be combined into a single class slot.
                                    </div>
                                )}
                            </div>
                        </form>
                    </div >
                )
            }

            <div className="glass overflow-hidden">
                <div className="flex items-center gap-3">

                    {/* Session Selector */}
                </div>
                <div className="overflow-x-auto">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-white border border-slate-200 rounded"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">White: Standalone</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-500 rounded"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Orange: Shared Slot</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-indigo-600 rounded"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Indigo: Selected</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                            <div className="w-4 h-4 rounded text-red-500 flex items-center justify-center font-black">×</div>
                            <span className="text-[9px] font-bold text-slate-400 italic">Detach Section</span>
                        </div>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-3 text-left">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox"
                                            checked={assignments.length > 0 && selectedAssignmentIds.length === assignments.length}
                                            onChange={e => setSelectedAssignmentIds(e.target.checked ? assignments.map(a => a.id) : [])}
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        {selectedAssignmentIds.length > 1 && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={handleCombineSelected}
                                                    className="px-2 py-1 bg-amber-500 text-white text-[10px] font-black uppercase rounded shadow-sm hover:bg-amber-600 transition-all flex items-center gap-1 animate-in zoom-in-95"
                                                    title="Combine Selected into Shared Slot"
                                                >
                                                    <HiOutlineSelector className="w-3 h-3" /> Combine
                                                </button>
                                                <button
                                                    onClick={handleBulkDelete}
                                                    className="px-2 py-1 bg-red-500 text-white text-[10px] font-black uppercase rounded shadow-sm hover:bg-red-600 transition-all flex items-center gap-1 animate-in zoom-in-95"
                                                    title="Delete Selected"
                                                >
                                                    <HiOutlineTrash className="w-3 h-3" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Teacher(s)</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Combined</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Split</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedAssignments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-10 text-center text-slate-400 text-sm italic">
                                        No assignments found for this session.
                                    </td>
                                </tr>
                            ) : viewMode === 'teacher' ? (
                                groupedAssignments.map((teacherGroup) => (
                                    <React.Fragment key={teacherGroup.id}>
                                        {/* Faculty Header Row */}
                                        <tr className="bg-slate-50 border-y border-slate-100">
                                            <td colSpan="6" className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <HiOutlineFolder className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{teacherGroup.name}</span>
                                                    <div className="flex items-center gap-2 ml-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${teacherGroup.global_load > 12 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                                            Load: {teacherGroup.slots.reduce((acc, slot) => {
                                                                const a = slot[0];
                                                                const load = (a.theory_credits || subjects.find(s => s.id === a.subject_id)?.theory_credits || 0) +
                                                                    ((a.lab_credits || subjects.find(s => s.id === a.subject_id)?.lab_credits) > 0 ? 3 : 0);
                                                                return acc + (load * (a.section_ids?.length || 0));
                                                            }, 0)}
                                                        </span>
                                                        {teachers.find(t => t.id === teacherGroup.id)?.global_load > 0 && (
                                                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold rounded">
                                                                Global: {teachers.find(t => t.id === teacherGroup.id)?.global_load}h
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 ml-auto">
                                                        {teacherGroup.slots.length} Slots
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Assignments/Slots for this Teacher */}
                                        {teacherGroup.slots.map((group) => {
                                            const isGroup = group.length > 1;
                                            const first = group[0];
                                            const comboId = first.combination_id;

                                            // Collect all sections across the group
                                            const allSectionIds = group.flatMap(a => a.section_ids || []);
                                            const uniqueSectionIds = [...new Set(allSectionIds)];

                                            return (
                                                <tr key={comboId || first.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${selectedAssignmentIds.includes(first.id) ? 'bg-primary-50/30' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <input type="checkbox"
                                                            checked={group.every(a => selectedAssignmentIds.includes(a.id))}
                                                            onChange={e => {
                                                                const ids = group.map(a => a.id);
                                                                setSelectedAssignmentIds(prev =>
                                                                    e.target.checked
                                                                        ? [...new Set([...prev, ...ids])]
                                                                        : prev.filter(id => !ids.includes(id))
                                                                );
                                                            }}
                                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-primary-600 bg-primary-100/50 px-2 py-0.5 rounded border border-primary-200">
                                                                    {first.subject_code || subjects.find(s => s.id === first.subject_id)?.code || `ID: ${first.subject_id}`}
                                                                </span>
                                                                {comboId && (
                                                                    <span className="text-[10px] font-black text-amber-600 bg-white px-1.5 py-0.5 rounded border-2 border-amber-500 uppercase shadow-sm">
                                                                        Shared Slot
                                                                    </span>
                                                                )}
                                                                {first.isCrossDept && (
                                                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase animate-pulse">
                                                                        Guest Assignment
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]" title={first.subject_full_name}>
                                                                {first.subject_full_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1">
                                                            {[...new Set(group.map(a => a.teacher_name || 'PENDING'))].map((t, idx) => (
                                                                <span key={idx} className={`text-xs ${t === 'PENDING' ? 'text-slate-400 italic' : 'font-medium text-slate-600'}`}>
                                                                    {t}
                                                                </span>
                                                            ))}
                                                            {[...new Set(group.filter(a => a.lab_engineer_id && a.lab_engineer_name).map(a => a.lab_engineer_name))].map((le, idx) => (
                                                                <span key={`le-${idx}`} className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-fit">
                                                                    LE: {le}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {/* COMBINED column */}
                                                        <div
                                                            className={`flex flex-wrap gap-1.5 min-h-[36px] p-1.5 rounded-lg border-2 border-dashed transition-all ${dragOverTarget === `combined-teacher-${comboId || first.id}` ? 'border-amber-400 bg-amber-50/80 shadow-inner' : 'border-transparent'}`}
                                                            onDragOver={(e) => onColumnDragOver(e, `combined-teacher-${comboId || first.id}`)}
                                                            onDragLeave={(e) => onColumnDragLeave(e, `combined-teacher-${comboId || first.id}`)}
                                                            onDrop={(e) => onDropToCombined(e, group)}
                                                        >
                                                            {group.filter(a => (a.combination_id || a.section_ids.length > 1)).flatMap(a => (a.section_ids || []).map(sid => ({ sid, a }))).map(({ sid, a }) => (
                                                                <div key={`${a.id}-${sid}`} className="flex items-center group/badge"
                                                                    draggable
                                                                    onDragStart={(e) => onBadgeDragStart(e, a.id, sid)}
                                                                    onDragEnd={onBadgeDragEnd}
                                                                >
                                                                    <span
                                                                        className={`px-2 py-1 border rounded text-[10px] font-bold transition-all shadow-sm cursor-grab active:cursor-grabbing ${(selectedSectionsForAction[comboId || first.id] || []).some(item => item.id === a.id && item.sid === sid)
                                                                            ? 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-500/20'
                                                                            : 'bg-amber-500 border-amber-600 text-white hover:scale-105'
                                                                            }`}
                                                                    >
                                                                        {sections.find(s => s.id === sid)?.display_name || sid}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {group.filter(a => (a.combination_id || a.section_ids.length > 1)).length === 0 && (
                                                                <span className="text-[9px] text-slate-300 italic select-none">Drop here to combine</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {/* SPLIT column */}
                                                        <div
                                                            className={`flex flex-wrap gap-1.5 min-h-[36px] p-1.5 rounded-lg border-2 border-dashed transition-all ${dragOverTarget === `split-teacher-${comboId || first.id}` ? 'border-sky-400 bg-sky-50/80 shadow-inner' : 'border-transparent bg-slate-50'}`}
                                                            onDragOver={(e) => onColumnDragOver(e, `split-teacher-${comboId || first.id}`)}
                                                            onDragLeave={(e) => onColumnDragLeave(e, `split-teacher-${comboId || first.id}`)}
                                                            onDrop={(e) => onDropToSplit(e)}
                                                        >
                                                            {group.filter(a => !(a.combination_id || a.section_ids.length > 1)).flatMap(a => (a.section_ids || []).map(sid => ({ sid, a }))).map(({ sid, a }) => (
                                                                <div key={`${a.id}-${sid}`} className="flex items-center group/badge"
                                                                    draggable
                                                                    onDragStart={(e) => onBadgeDragStart(e, a.id, sid)}
                                                                    onDragEnd={onBadgeDragEnd}
                                                                >
                                                                    <span
                                                                        className={`px-2 py-1 border rounded text-[10px] font-bold transition-all shadow-sm cursor-grab active:cursor-grabbing ${(selectedSectionsForAction[comboId || first.id] || []).some(item => item.id === a.id && item.sid === sid)
                                                                            ? 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-500/20'
                                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600'
                                                                            }`}
                                                                    >
                                                                        {sections.find(s => s.id === sid)?.display_name || sid}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {group.filter(a => !(a.combination_id || a.section_ids.length > 1)).length === 0 && (
                                                                <span className="text-[9px] text-slate-300 italic select-none">Drop here to split</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {canCombine && !activeSession?.is_archived && (
                                                                <button
                                                                    onClick={() => {
                                                                        // Set up mini-group mapping for the modal
                                                                        const sg = {
                                                                            id: first.subject_id,
                                                                            code: first.subject_code,
                                                                            name: first.subject_full_name || subjects.find(s => s.id === first.subject_id)?.full_name,
                                                                            rows: [{ key: comboId || first.id, assignments: group }],
                                                                            batch_id: first.batch_id
                                                                        };
                                                                        setActiveSubjectGroup(sg);
                                                                        setShowSubjectModal(true);
                                                                    }}
                                                                    className="px-2 py-1 bg-primary-600 text-white rounded-lg transition-all hover:bg-primary-700 active:scale-95 flex items-center gap-1 shadow-sm h-7"
                                                                    title="Open Master Manager"
                                                                >
                                                                    <span className="text-[11px] font-black">{"<>"}</span>
                                                                </button>
                                                            )}
                                                            {!isGroup && !activeSession?.is_archived && (
                                                                <button onClick={() => setEditingAssignment({ ...first })}
                                                                    className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                                                                    <HiOutlineSelector className="w-4 h-4 rotate-90" />
                                                                </button>
                                                            )}
                                                            {!activeSession?.is_archived && (
                                                                <button onClick={() => {
                                                                    if (confirm(`Delete ${isGroup ? 'all ' + group.length : 'this'} assignment(s)?`)) {
                                                                        handleBulkDeleteByIds(group.map(a => a.id));
                                                                    }
                                                                }}
                                                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                                                                    <HiOutlineTrash className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {activeSession?.is_archived && <span className="text-[10px] font-bold text-slate-400 uppercase italic">Locked</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))
                            ) : (
                                // Batchwise Rendering
                                groupedAssignments.map((dept) => (
                                    <React.Fragment key={dept.code}>
                                        <tr className="bg-indigo-50/30 border-y border-indigo-100">
                                            <td colSpan="6" className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <HiOutlineOfficeBuilding className="w-4 h-4 text-indigo-500" />
                                                    <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">{dept.code} Department</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {Object.values(dept.batches).map((batch) => (
                                            <React.Fragment key={batch.id}>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <td colSpan="6" className="px-8 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <HiOutlineAcademicCap className="w-3.5 h-3.5 text-slate-400" />
                                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{batch.name}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {batch.rowGroups.map((group) => (
                                                    <tr key={group.key} className="border-b border-slate-50 hover:bg-slate-100/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <input type="checkbox"
                                                                checked={group.assignments.every(a => selectedAssignmentIds.includes(a.id))}
                                                                onChange={e => {
                                                                    const ids = group.assignments.map(a => a.id);
                                                                    setSelectedAssignmentIds(prev =>
                                                                        e.target.checked ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id))
                                                                    );
                                                                }}
                                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-primary-700 bg-primary-100/50 px-2 py-0.5 rounded border border-primary-200 w-fit mb-1">
                                                                    {group.subject_code}
                                                                </span>
                                                                <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]" title={group.subject_name}>
                                                                    {group.subject_name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-1">
                                                                {[...new Set(group.assignments.map(a => a.teacher_name || 'PENDING'))].map((t, idx) => (
                                                                    <span key={idx} className={`text-xs ${t === 'PENDING' ? 'text-slate-400 italic' : 'font-medium text-slate-600'}`}>
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                                {[...new Set(group.assignments.filter(a => a.lab_engineer_id && a.lab_engineer_name).map(a => a.lab_engineer_name))].map((le, idx) => (
                                                                    <span key={`le-${idx}`} className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-fit">
                                                                        LE: {le}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div
                                                                className={`flex flex-wrap gap-1.5 min-h-[36px] p-1.5 rounded-lg border-2 border-dashed transition-all ${dragOverTarget === `combined-batch-${group.key}` ? 'border-amber-400 bg-amber-50/80 shadow-inner' : 'border-transparent'}`}
                                                                onDragOver={(e) => onColumnDragOver(e, `combined-batch-${group.key}`)}
                                                                onDragLeave={(e) => onColumnDragLeave(e, `combined-batch-${group.key}`)}
                                                                onDrop={(e) => onDropToCombined(e, group.assignments)}
                                                            >
                                                                {group.assignments.filter(a => (a.combination_id || a.section_ids.length > 1)).flatMap(a => (a.section_ids || []).map(sid => ({ sid, a }))).map(({ sid, a }) => (
                                                                    <div key={`${a.id}-${sid}`} className="flex items-center group/badge"
                                                                        draggable
                                                                        onDragStart={(e) => onBadgeDragStart(e, a.id, sid)}
                                                                        onDragEnd={onBadgeDragEnd}
                                                                    >
                                                                        <span
                                                                            className={`px-2 py-1 border rounded text-[10px] font-bold transition-all shadow-sm cursor-grab active:cursor-grabbing ${(selectedSectionsForAction[group.key] || []).some(item => item.id === a.id && item.sid === sid)
                                                                                ? 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-500/20'
                                                                                : 'bg-amber-500 border-amber-600 text-white hover:scale-105'
                                                                                }`}
                                                                        >
                                                                            {sections.find(s => s.id === sid)?.display_name || sid}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                {group.assignments.filter(a => (a.combination_id || a.section_ids.length > 1)).length === 0 && (
                                                                    <span className="text-[9px] text-slate-300 italic select-none">Drop here to combine</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div
                                                                className={`flex flex-wrap gap-1.5 min-h-[36px] p-1.5 rounded-lg border-2 border-dashed transition-all ${dragOverTarget === `split-batch-${group.key}` ? 'border-sky-400 bg-sky-50/80 shadow-inner' : 'border-transparent bg-slate-50'}`}
                                                                onDragOver={(e) => onColumnDragOver(e, `split-batch-${group.key}`)}
                                                                onDragLeave={(e) => onColumnDragLeave(e, `split-batch-${group.key}`)}
                                                                onDrop={(e) => onDropToSplit(e)}
                                                            >
                                                                {group.assignments.filter(a => !(a.combination_id || a.section_ids.length > 1)).flatMap(a => (a.section_ids || []).map(sid => ({ sid, a }))).map(({ sid, a }) => (
                                                                    <div key={`${a.id}-${sid}`} className="flex items-center group/badge"
                                                                        draggable
                                                                        onDragStart={(e) => onBadgeDragStart(e, a.id, sid)}
                                                                        onDragEnd={onBadgeDragEnd}
                                                                    >
                                                                        <span
                                                                            className={`px-2 py-1 border rounded text-[10px] font-bold transition-all shadow-sm cursor-grab active:cursor-grabbing ${(selectedSectionsForAction[group.key] || []).some(item => item.id === a.id && item.sid === sid)
                                                                                ? 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-500/20'
                                                                                : 'bg-white border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600'
                                                                                }`}
                                                                        >
                                                                            {sections.find(s => s.id === sid)?.display_name || sid}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                {group.assignments.filter(a => !(a.combination_id || a.section_ids.length > 1)).length === 0 && (
                                                                    <span className="text-[9px] text-slate-300 italic select-none">Drop here to split</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {selectedSectionsForAction[group.key]?.length > 1 && (
                                                                    <button
                                                                        onClick={() => handleCombineSelectedInRow(group.key)}
                                                                        className="px-2 py-1 bg-amber-600 text-white text-[9px] font-black uppercase rounded shadow-lg hover:bg-amber-700 animate-in zoom-in-95"
                                                                    >
                                                                        Combine
                                                                    </button>
                                                                )}
                                                                {selectedSectionsForAction[group.key]?.length === 1 && (
                                                                    (() => {
                                                                        const item = selectedSectionsForAction[group.key][0];
                                                                        const a = group.assignments.find(as => as.id === item.id);
                                                                        const isComb = a && (a.section_ids.length > 1 || a.combination_id);
                                                                        if (isComb) return (
                                                                            <button
                                                                                onClick={() => handleSplitSectionAction(item, group.key)}
                                                                                className="px-2 py-1 bg-slate-600 text-white text-[9px] font-black uppercase rounded-lg shadow hover:bg-slate-700 animate-in zoom-in-95"
                                                                            >
                                                                                Uncombine Slot
                                                                            </button>
                                                                        );
                                                                        return null;
                                                                    })()
                                                                )}
                                                                <button
                                                                    onClick={() => { setActiveSubjectGroup({ ...group, batch_id: batch.id }); setShowSubjectModal(true); }}
                                                                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                                    title="Manage Subject"
                                                                >
                                                                    <HiOutlineSelector className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(`Delete ALL assignments for ${group.subject_code} in this batch?`)) {
                                                                            handleBulkDeleteByIds(group.assignments.map(a => a.id));
                                                                        }
                                                                    }}
                                                                    className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete Row"
                                                                >
                                                                    <HiOutlineTrash className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div >
            {/* Slot Manager Modal */}
            {
                showSlotManager && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="font-bold text-slate-800">Manage Shared Time Slot</h2>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Slot Ref: {activeSlot}</p>
                                </div>
                                <button onClick={() => { setShowSlotManager(false); setActiveSlot(null); }} className="text-slate-400 hover:text-slate-600">
                                    <HiOutlineX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Current Members */}
                                <div>
                                    <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-3">Assignments in this Slot</label>
                                    <div className="space-y-2">
                                        {assignments.filter(a => a.combination_id === activeSlot || a.id === activeSlot).map(a => (
                                            <div key={a.id} className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{a.subject_code} ({a.batch_id ? batches.find(b => b.id === a.batch_id)?.display_name : 'N/A'})</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(a.section_ids || []).map(sid => (
                                                            <span key={sid} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase">
                                                                {sections.find(s => s.id === sid)?.display_name ||
                                                                    (a.section_names && a.section_ids?.indexOf(sid) !== -1 ? a.section_names[a.section_ids.indexOf(sid)] : sid)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleUnmerge(a.id)}
                                                    className="p-1.5 text-amber-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Remove from slot">
                                                    <HiOutlineX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Add Others */}
                                <div>
                                    <label className="text-[10px] font-black text-primary-600 uppercase tracking-widest block mb-3">Add to this Slot</label>
                                    {(() => {
                                        const slotTeacherId = assignments.find(a => a.combination_id === activeSlot || a.id === activeSlot)?.teacher_id;
                                        const potential = assignments.filter(a => a.teacher_id === slotTeacherId && a.combination_id !== activeSlot && a.id !== activeSlot);

                                        if (potential.length === 0) return <p className="text-xs text-slate-400 italic py-2">No other assignments found for this teacher.</p>;

                                        return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {potential.map(a => (
                                                    <button key={a.id} onClick={() => {
                                                        const target = assignments.find(x => x.combination_id === activeSlot || x.id === activeSlot);
                                                        api.post('/assignments/merge', null, {
                                                            params: { assignment_id: a.id, target_assignment_id: target.id }
                                                        }).then(() => loadAssignments());
                                                    }}
                                                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-primary-200 hover:bg-primary-50 transition-all text-left">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">{a.subject_code}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">
                                                                {(a.section_names || []).join(', ') || `${a.section_ids?.length} Sections`}
                                                            </p>
                                                        </div>
                                                        <HiOutlinePlus className="w-4 h-4 text-primary-500" />
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button onClick={() => setShowSlotManager(false)}
                                    className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all">
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Import Review Modal */}
            {
                showImportModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Review Assignments Import</h2>
                                    <p className="text-sm text-slate-500">Verify extracted data and match with your database</p>
                                </div>
                                <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                    <HiOutlineX className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Session</label>
                                        <select value={importSessionId} onChange={e => setImportSessionId(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary-500/10">
                                            <option value="">Select Session</option>
                                            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Batch</label>
                                        <select value={importBatchId} onChange={e => setImportBatchId(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary-500/10">
                                            <option value="">Select Batch</option>
                                            {batches.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Extracted Row</th>
                                                <th className="px-4 py-3">Matched Teacher</th>
                                                <th className="px-4 py-3">Matched Subject</th>
                                                <th className="px-4 py-3">Matched Batch</th>
                                                <th className="px-4 py-3">Lab Engineer</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {importData.map((row, idx) => (row && (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <p className="font-bold text-slate-700">{row.raw_teacher}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{row.raw_subject} ({row.theory_credits}+{row.lab_credits})</p>
                                                        {row.raw_batch && (
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold rounded border border-indigo-100 mr-1">
                                                                📦 {row.raw_batch}
                                                            </span>
                                                        )}
                                                        {row.raw_sections && (
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold rounded border border-purple-100">
                                                                📋 Sec: {row.raw_sections}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <select
                                                            value={row.matched_teacher_id || ''}
                                                            onChange={e => {
                                                                const newData = [...importData];
                                                                newData[idx].matched_teacher_id = parseInt(e.target.value);
                                                                setImportData(newData);
                                                            }}
                                                            className={`w-full bg-white border rounded-lg px-2 py-1.5 text-xs outline-none ${!row.matched_teacher_id ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}
                                                        >
                                                            <option value="">Select Teacher</option>
                                                            {facultyTeachers.map(t => <option key={t.id} value={t.id}>{t.display_full_name}</option>)}
                                                            {labEngineers.length > 0 && <option disabled style={{ fontWeight: 'bold' }}>── Lab Engineers ──</option>}
                                                            {labEngineers.map(t => <option key={`le-${t.id}`} value={t.id}>{t.display_full_name}</option>)}
                                                        </select>
                                                        {!row.matched_teacher_id && row.raw_teacher && (
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        const res = await api.post('/teachers/', {
                                                                            name: row.raw_teacher,
                                                                            designation: 'Lecturer',
                                                                            max_contact_hours: 12,
                                                                            department_id: user.department_id,
                                                                            assign_account: true,
                                                                            is_lab_engineer: false,
                                                                        });
                                                                        // Add the new teacher to local list & auto-select
                                                                        const newTeacher = res.data;
                                                                        setTeachers(prev => [...prev, newTeacher]);
                                                                        const newData = [...importData];
                                                                        newData[idx].matched_teacher_id = newTeacher.id;
                                                                        newData[idx].matched_teacher_name = newTeacher.name;
                                                                        setImportData(newData);
                                                                    } catch (err) {
                                                                        alert(err.response?.data?.detail || 'Failed to create teacher');
                                                                    }
                                                                }}
                                                                className="mt-1 flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 transition-colors"
                                                            >
                                                                ⚡ Add "{row.raw_teacher}" as New Teacher
                                                            </button>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <select
                                                            value={row.matched_subject_id || ''}
                                                            onChange={e => {
                                                                const newData = [...importData];
                                                                newData[idx].matched_subject_id = parseInt(e.target.value);
                                                                setImportData(newData);
                                                            }}
                                                            className={`w-full bg-white border rounded-lg px-2 py-1.5 text-xs outline-none ${!row.matched_subject_id ? 'border-amber-200' : 'border-slate-200'}`}
                                                        >
                                                            <option value="">Select Subject</option>
                                                            {subjects.filter(s => user.role === 'super_admin' || s.department_id === user.department_id).map(s => <option key={s.id} value={s.id}>{s.code} - {s.full_name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <select
                                                            value={row.matched_batch_id || ''}
                                                            onChange={e => {
                                                                const newData = [...importData];
                                                                newData[idx].matched_batch_id = e.target.value ? parseInt(e.target.value) : null;
                                                                setImportData(newData);
                                                            }}
                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                        >
                                                            <option value="">Same as Global</option>
                                                            {batches.filter(b => user.role === 'super_admin' || b.department_id === user.department_id).map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {row.lab_credits > 0 ? (
                                                            <select
                                                                value={row.matched_lab_engineer_id || ''}
                                                                onChange={e => {
                                                                    const newData = [...importData];
                                                                    newData[idx].matched_lab_engineer_id = parseInt(e.target.value);
                                                                    setImportData(newData);
                                                                }}
                                                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                                                            >
                                                                <option value="">Select Lab Engineer</option>
                                                                {labEngineers.map(t => <option key={t.id} value={t.id}>{t.display_full_name}</option>)}
                                                                {facultyTeachers.length > 0 && <option disabled style={{ fontWeight: 'bold' }}>── Teachers ──</option>}
                                                                {facultyTeachers.map(t => <option key={`t-${t.id}`} value={t.id}>{t.display_full_name}</option>)}
                                                            </select>
                                                        ) : (
                                                            <span className="text-slate-300 text-[10px] italic">Theory Only</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button onClick={() => setImportData(importData.filter((_, i) => i !== idx))} className="p-1.5 text-slate-400 hover:text-red-500">
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs text-slate-500 font-medium">{importData.length} records detected</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowImportModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Discard</button>
                                    <button onClick={handleFinalizeImport} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all">Finalize Import</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
