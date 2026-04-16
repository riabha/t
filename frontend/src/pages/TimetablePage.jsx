import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TimetableGrid from '../components/TimetableGrid';
import { HiOutlineRefresh, HiOutlineDownload, HiOutlineFilter, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ical from 'ical-generator';

export default function TimetablePage() {
    const { isAdmin, user, isSuperAdmin, canDeleteTimetable } = useAuth();
    const [timetables, setTimetables] = useState([]);
    const [activeTT, setActiveTT] = useState(null);
    const [ttData, setTTData] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [timetableName, setTimetableName] = useState('');
    const [generationError, setGenerationError] = useState(null);

    // Advanced Settings State
    const [extraClasses, setExtraClasses] = useState(0);
    const [classDuration, setClassDuration] = useState(60);
    const [startTime, setStartTime] = useState("08:30");
    const [breakSlot, setBreakSlot] = useState(2); // Break after slot #3 (index 2)
    const [breakDuration, setBreakDuration] = useState(30); // Break duration in minutes
    const [maxSlotsPerDay, setMaxSlotsPerDay] = useState(8);
    const [maxSlotsFriday, setMaxSlotsFriday] = useState(4);
    const [semesterType, setSemesterType] = useState("Fall");
    const [fridayHasBreak, setFridayHasBreak] = useState(false);
    const [allowFridayLabs, setAllowFridayLabs] = useState(false);  // No labs on Friday
    const [preferEarlyDismissal, setPreferEarlyDismissal] = useState(true);
    const [labIsLast, setLabIsLast] = useState(true);
    const [earlyFinishClasses, setEarlyFinishClasses] = useState(false);
    const [earlyFinishBatchIds, setEarlyFinishBatchIds] = useState([]);
    const [sections, setSections] = useState([]);
    const [batches, setBatches] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [filterType, setFilterType] = useState('section');
    const [filterValue, setFilterValue] = useState('');
    const [filteredSlots, setFilteredSlots] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [genSessionId, setGenSessionId] = useState('');
    const [genBatchIds, setGenBatchIds] = useState([]); // Empty = Bulk
    const [genTargetTTId, setGenTargetTTId] = useState(''); // Empty = New Timetable
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedVersion, setSelectedVersion] = useState('latest'); // 'latest' or 'previous'
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedArchiveTT, setSelectedArchiveTT] = useState('');
    const [departments, setDepartments] = useState([]);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressStep, setProgressStep] = useState(0);
    const [sequentialMode, setSequentialMode] = useState(false); // Sequential batch-wise generation

    // Calculate break start and end times automatically based on slot position
    const calculateBreakTimes = () => {
        const [startH, startM] = startTime.split(':').map(Number);
        
        // Calculate break start time (after breakSlot number of classes)
        const breakStartMinutes = (startH * 60 + startM) + (breakSlot * classDuration);
        const breakStartH = Math.floor(breakStartMinutes / 60);
        const breakStartM = breakStartMinutes % 60;
        const breakStart = `${breakStartH.toString().padStart(2, '0')}:${breakStartM.toString().padStart(2, '0')}`;
        
        // Calculate break end time
        const breakEndMinutes = breakStartMinutes + breakDuration;
        const breakEndH = Math.floor(breakEndMinutes / 60);
        const breakEndM = breakEndMinutes % 60;
        const breakEnd = `${breakEndH.toString().padStart(2, '0')}:${breakEndM.toString().padStart(2, '0')}`;
        
        return { breakStart, breakEnd };
    };

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

    useEffect(() => {
        loadList();
    }, []);

    const loadList = async () => {
        const res = await api.get('/timetable/list');
        setTimetables(res.data);
        const [secRes, bRes, tRes, sessRes, deptsRes] = await Promise.all([
            api.get('/departments/sections'),
            api.get('/departments/batches'),
            api.get('/teachers/'),
            api.get('/assignments/sessions'),
            api.get('/departments/')
        ]);
        setSections(secRes.data);
        setBatches(bRes.data);
        setTeachers(tRes.data.filter(t => !t.is_lab_engineer));
        setSessions(sessRes.data);
        setDepartments(deptsRes.data);
        if (sessRes.data.length > 0) setGenSessionId(sessRes.data[0].id);

        // Default to user's department
        if (user?.department_id) {
            setSelectedDept(user.department_id.toString());
        } else if (deptsRes.data.length > 0) {
            setSelectedDept(deptsRes.data[0].id.toString());
        }
    };

    useEffect(() => {
        if (selectedDept && timetables.length > 0) {
            const deptTTs = timetables.filter(t => t.department_id === parseInt(selectedDept));
            const latestTTs = deptTTs.filter(t => t.status !== 'archived');
            const archivedTTs = deptTTs.filter(t => t.status === 'archived');

            if (selectedVersion === 'latest') {
                if (latestTTs.length > 0) {
                    loadTimetable(latestTTs[0].id);
                } else if (deptTTs.length > 0) {
                    loadTimetable(deptTTs[0].id);
                } else {
                    setTTData(null); setActiveTT(null);
                }
            } else {
                // Previous mode: use archived timetables
                if (selectedArchiveTT && deptTTs.some(t => t.id === parseInt(selectedArchiveTT))) {
                    loadTimetable(parseInt(selectedArchiveTT));
                } else if (archivedTTs.length > 0) {
                    setSelectedArchiveTT(archivedTTs[0].id.toString());
                } else {
                    setTTData(null); setActiveTT(null);
                }
            }
        }
    }, [selectedDept, selectedVersion, selectedArchiveTT, timetables]);

    const loadTimetable = async (id) => {
        setActiveTT(id);
        const res = await api.get(`/timetable/${id}`);
        setTTData(res.data);
        setFilteredSlots(res.data.slots || []);
        setFilterValue('');
    };

    const handleGenerate = async () => {
        if (!genSessionId) return alert('Please select an assignment session');

        const selectedSession = sessions.find(s => s.id === parseInt(genSessionId));
        const derivedName = timetableName.trim() || (`${selectedSession?.name || 'New'} Timetable` +
            (genBatchIds.length > 0 ? ` (${genBatchIds.length} Batches)` : ' (Bulk)'));

        // Calculate break times automatically based on slot position
        const { breakStart, breakEnd } = calculateBreakTimes();

        setGenerating(true);
        setShowProgressModal(true);
        setProgressStep(0);
        
        // Simulate progress steps
        const progressInterval = setInterval(() => {
            setProgressStep(prev => {
                if (prev < 3) return prev + 1;
                return prev;
            });
        }, 800);

        try {
            const res = await api.post('/timetable/generate', {
                name: derivedName,
                semester_info: `${semesterType} ${new Date().getFullYear()}`,
                session_id: parseInt(genSessionId),
                batch_ids: genBatchIds.length > 0 ? genBatchIds.map(id => parseInt(id)) : null,
                sequential_mode: sequentialMode, // Enable sequential batch-wise generation
                extra_classes_per_subject: parseInt(extraClasses),
                class_duration: parseInt(classDuration),
                start_time: startTime,
                break_slot: parseInt(breakSlot),
                break_start_time: breakStart,
                break_end_time: breakEnd,
                max_slots_per_day: parseInt(maxSlotsPerDay),
                max_slots_friday: parseInt(maxSlotsFriday),
                semester_type: semesterType,
                friday_has_break: fridayHasBreak,
                allow_friday_labs: allowFridayLabs,
                prefer_early_dismissal: preferEarlyDismissal,
                lab_is_last: labIsLast,
                uniform_lab_start_batch_ids: earlyFinishClasses ? earlyFinishBatchIds.map(id => parseInt(id)) : [],
                timetable_id: genTargetTTId ? parseInt(genTargetTTId) : null
            });
            if (res.data.status === 'generated') {
                clearInterval(progressInterval);
                setProgressStep(4); // Complete
                await loadList();
                loadTimetable(res.data.id);
                setGenBatchIds([]);
                setTimetableName('');
                setTimeout(() => {
                    setShowProgressModal(false);
                    setProgressStep(0);
                }, 1000);
            } else if (res.data.status === 'empty') {
                clearInterval(progressInterval);
                setShowProgressModal(false);
                alert('Generation Empty: No assignments found for the selected session and batches. Did you select the correct session?');
            } else {
                clearInterval(progressInterval);
                setShowProgressModal(false);
                alert('Generation returned: ' + res.data.status);
            }
        } catch (e) {
            clearInterval(progressInterval);
            setShowProgressModal(false);
            console.error('Generation error:', e);
            const errorDetail = e.response?.data?.detail || 'Generation failed';

            // Check if it's a structured error object
            if (typeof errorDetail === 'object' && errorDetail.error_type === 'morning_lab_conflict') {
                // Format the morning lab conflict error nicely
                setGenerationError(errorDetail.message);
            } else if (typeof errorDetail === 'object') {
                // Other structured error
                setGenerationError(JSON.stringify(errorDetail, null, 2));
            } else {
                // Simple string error
                setGenerationError(errorDetail);
            }

            // Also show alert for immediate feedback
            alert(`Generation Failed:\n\n${typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail, null, 2)}`);
        }
        setGenerating(false);
    };

    const toggleGenBatch = (id) => {
        setGenBatchIds(prev =>
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this timetable? This cannot be undone.')) return;
        try {
            await api.delete(`/timetable/${id}`);
            await loadList();
            if (activeTT === id) {
                setActiveTT(null);
                setTTData(null);
            }
            console.log('DEBUG: Delete successful');
        } catch (e) {
            console.error('DEBUG: Delete failed', e);
            alert(e.response?.data?.detail || 'Delete failed');
        }
    };

    const handleRemoveBatch = async (batchId) => {
        if (!activeTT) return;
        const batch = batches.find(b => b.id === batchId);
        if (!window.confirm(`Are you sure you want to remove all slots for ${batch?.display_name || 'this batch'} from the current timetable?`)) return;

        try {
            await api.delete(`/timetable/${activeTT}/batch/${batchId}`);
            await loadTimetable(activeTT);
        } catch (e) {
            alert(e.response?.data?.detail || 'Remove failed');
        }
    };

    const handleRename = async (id, oldName) => {
        console.log('RENAME CLICKED for id:', id);
        const newName = window.prompt('Enter new name for timetable:', oldName);
        if (!newName || newName === oldName) return;
        try {
            await api.patch(`/timetable/${id}`, { name: newName });
            await loadList();
            if (activeTT === id) {
                setTTData(prev => ({ ...prev, name: newName }));
            }
        } catch (e) {
            alert(e.response?.data?.detail || 'Rename failed');
        }
    };

    const handleRestore = async (id) => {
        if (!window.confirm('Are you sure you want to restore this archived timetable? It will become visible in the "Latest" version.')) return;
        try {
            await api.patch(`/timetable/${id}`, { status: 'generated' });
            await loadList();
            setSelectedVersion('latest');
            setActiveTT(id);
        } catch (e) {
            alert(e.response?.data?.detail || 'Restore failed');
        }
    };

    const handleFilter = (val, type = filterType) => {
        setFilterValue(val);
        let baseSlots = ttData?.slots || [];

        // Apply Department Filter: only show sections belonging to selected department's batches
        if (selectedDept) {
            const deptBatchIds = batches.filter(b => b.department_id === parseInt(selectedDept)).map(b => b.id);
            const deptSectionIds = sections.filter(sec => deptBatchIds.includes(sec.batch_id)).map(sec => sec.id);
            baseSlots = baseSlots.filter(s => deptSectionIds.includes(s.section_id));
        }

        // Apply Batch Filter if selected
        if (selectedBatchId) {
            const batchSections = sections.filter(sec => sec.batch_id === parseInt(selectedBatchId)).map(sec => sec.id);
            baseSlots = baseSlots.filter(s => batchSections.includes(s.section_id));
        }

        if (!val) {
            setFilteredSlots(baseSlots);
            return;
        }

        if (type === 'section') {
            setFilteredSlots(baseSlots.filter(s => s.section_id === parseInt(val)));
        } else {
            setFilteredSlots(baseSlots.filter(s => s.teacher_name?.toLowerCase().includes(val.toLowerCase())));
        }
    };

    // Update filtered slots when selectedBatchId or ttData changes
    useEffect(() => {
        handleFilter(filterValue);
    }, [selectedBatchId, selectedDept, ttData]);

    const handleExport = async () => {
        try {
            const res = await api.get(`/timetable/${activeTT}/export/excel`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `timetable-${activeTT}.xlsx`;
            link.click();
        } catch (e) { alert('Export failed'); }
    };

    const exportToPDF = () => {
        try {
            if (!ttData || !filteredSlots.length) {
                alert('No timetable data to export');
                return;
            }

            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const duration = ttData?.class_duration || 60;
            const breakSlot = ttData?.break_slot ?? 2;
            const breakStart = ttData?.break_start_time || "10:30";
            const breakEnd = ttData?.break_end_time || "11:00";

            // Generate time slots exactly like TimetableGrid
            const generateSlotTimes = () => {
                let times = [];
                let currentTime = new Date();
                currentTime.setHours(8, 30, 0); // Start at 8:30

                const formatTime = (date) => {
                    return date.getHours() + ":" + date.getMinutes().toString().padStart(2, '0');
                };

                for (let i = 0; i < 8; i++) {
                    if (i === breakSlot) {
                        times.push(`${breakStart}-${breakEnd}\nBreak`);
                        const [bh, bm] = breakEnd.split(':').map(Number);
                        currentTime.setHours(bh, bm, 0);
                    } else {
                        let start = formatTime(currentTime);
                        currentTime.setMinutes(currentTime.getMinutes() + duration);
                        let end = formatTime(currentTime);
                        times.push(`${start}-${end}`);
                    }
                }
                return times;
            };

            const slotTimes = generateSlotTimes();

            // Group slots by section
            const slotsBySection = {};
            filteredSlots.forEach(s => {
                const key = s.section_id || 'na';
                if (!slotsBySection[key]) slotsBySection[key] = { name: s.section_name || `Section ${key}`, slots: [] };
                slotsBySection[key].slots.push(s);
            });

            let isFirstPage = true;

            Object.values(slotsBySection).forEach(section => {
                if (!isFirstPage) {
                    doc.addPage();
                }
                isFirstPage = false;

                // Add logo
                try {
                    const img = new Image();
                    img.src = '/logo.png';
                    doc.addImage(img, 'PNG', 14, 8, 15, 15);
                } catch (e) {
                    console.log('Logo not loaded');
                }

                // Header
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                doc.text('Quaid-e-Awam University', 35, 14);
                doc.setFontSize(12);
                doc.setFont(undefined, 'normal');
                doc.text('Timetable Portal', 35, 20);

                // Get classroom for this section (from first non-break slot)
                const firstSlot = section.slots.find(s => !s.is_break && s.room_name);
                const classroom = firstSlot?.room_name || '';

                // Section name with classroom
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                const sectionTitle = classroom ? `${section.name} (${classroom})` : section.name;
                doc.text(sectionTitle, 14, 36);

                // Create time slot headers
                const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                const timeHeaders = ['Day', ...slotTimes]; // Use generated slotTimes for headers
                const maxSlots = 8; // Still 8 slots including the break slot

                // Prepare table data - only subject codes
                const tableData = [];
                const subjectDetails = {}; // For legend

                for (let d = 0; d < 5; d++) {
                    const row = [days[d]];

                    // Find which slot is the break for this section on this day
                    // (Morning labs push break from slot 2 → slot 3)
                    const breakSlotThisDay = section.slots.find(sl => sl.day === d && sl.is_break)?.slot_index ?? breakSlot;

                    // Generate per-day slot times reflecting the actual break position for this row
                    const daySlotLabels = (() => {
                        const labels = [];
                        const fmt = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
                        let h = 8, m = 30;
                        for (let s = 0; s < 8; s++) {
                            if (s === breakSlotThisDay) {
                                labels.push(`${breakStart}-${breakEnd}\nBreak`);
                                const [bh, bm] = breakEnd.split(':').map(Number);
                                h = bh; m = bm;
                            } else {
                                const startStr = fmt(h, m);
                                m += duration;
                                if (m >= 60) { h += Math.floor(m / 60); m %= 60; }
                                labels.push(`${startStr}-${fmt(h, m)}`);
                            }
                        }
                        return labels;
                    })();

                    for (let s = 0; s < maxSlots; s++) {
                        const slot = section.slots.find(sl => sl.day === d && sl.slot_index === s);
                        if (slot && !slot.is_break) {
                            if (slot.label && (slot.label === 'FYP-I' || slot.label === 'FYP-II')) {
                                row.push(slot.label);
                            } else if (slot.subject_code) {
                                row.push(slot.subject_code + (slot.is_lab ? '\n(Lab)' : ''));

                                // Collect subject details for legend
                                if (!subjectDetails[slot.subject_code]) {
                                    subjectDetails[slot.subject_code] = {
                                        name: slot.subject_name || slot.subject_code,
                                        teacher: null,
                                        labEngineer: null,
                                        theoryCredits: slot.theory_credits || 3,
                                        labCredits: slot.lab_credits || 0
                                    };
                                }
                                if (slot.is_lab) {
                                    if (slot.lab_engineer_name) subjectDetails[slot.subject_code].labEngineer = slot.lab_engineer_name;
                                } else {
                                    if (slot.teacher_name) subjectDetails[slot.subject_code].teacher = slot.teacher_name;
                                }
                            } else {
                                row.push('-');
                            }
                        } else if (slot && slot.is_break) {
                            // Show break with its actual time for this day
                            row.push(`Break\n${daySlotLabels[s]}`);
                        } else {
                            row.push('-');
                        }
                    }
                    tableData.push(row);
                }

                // Add table
                autoTable(doc, {
                    head: [timeHeaders],
                    body: tableData,
                    startY: 42,
                    styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
                    headStyles: { fillColor: [71, 85, 105], fontStyle: 'bold', fontSize: 7 },
                    columnStyles: {
                        0: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'left' }
                    }
                });

                // Add legend as a table with gap above
                const finalY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('Details:', 14, finalY);

                // Prepare legend table data
                const legendData = [];
                Object.entries(subjectDetails).forEach(([code, details]) => {
                    // Calculate contact hours: theory + (lab × 3)
                    const theoryHours = details.theoryCredits || 0;
                    const labHours = (details.labCredits || 0) * 3;
                    let creditHours = `${theoryHours}+${labHours}`;

                    legendData.push([
                        code,
                        details.name,
                        creditHours,
                        details.teacher || '-',
                        details.labEngineer || '-'
                    ]);
                });

                // Add legend table immediately below Details text
                autoTable(doc, {
                    head: [['Code', 'Subject Name', 'Credit Hours', 'Teacher', 'Lab Engineer']],
                    body: legendData,
                    startY: finalY + 2,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [71, 85, 105], fontStyle: 'bold', fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: 20, fontStyle: 'bold' },
                        1: { cellWidth: 80 },
                        2: { cellWidth: 25, halign: 'center' },
                        3: { cellWidth: 50 },
                        4: { cellWidth: 50 }
                    }
                });

                // Add approval note at bottom (smaller font)
                const approvalY = doc.lastAutoTable.finalY + 8;
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                const deptName = departments.find(d => d.id === parseInt(selectedDept))?.name || 'Concerned Department';
                doc.text(`The time table is approved by Chairman ${deptName}`, 14, approvalY);

                // Add approved stamp image overlapping the bottom of details table (24mm width, height auto-calculated)
                try {
                    const stampImg = new Image();
                    stampImg.src = '/approve.png';
                    const stampWidth = 24; // 24mm width
                    // Position stamp to overlap bottom of details table on right corner
                    const tableEndY = doc.lastAutoTable.finalY;
                    doc.addImage(stampImg, 'PNG', 225, tableEndY - 15, stampWidth, 0);
                } catch (e) {
                    console.log('Approved stamp not loaded, using text fallback');
                    // Fallback: Simple "Approved" stamp box
                    const stampX = 200;
                    const stampY = approvalY - 4;
                    const stampWidth = 30;
                    const stampHeight = 10;
                    doc.setDrawColor(71, 85, 105);
                    doc.setLineWidth(0.8);
                    doc.rect(stampX, stampY, stampWidth, stampHeight, 'S');
                    doc.setLineWidth(0.3);
                    doc.rect(stampX + 1, stampY + 1, stampWidth - 2, stampHeight - 2, 'S');
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'bold');
                    doc.text('Approved', stampX + stampWidth / 2, stampY + stampHeight / 2 + 1.5, { align: 'center' });
                }
            });

            const deptName = departments.find(d => d.id === parseInt(selectedDept))?.code || 'Timetable';
            doc.save(`${deptName}_${ttData.name}_Admin.pdf`);
            console.log('PDF generated successfully!');
        } catch (error) {
            console.error('PDF generation error:', error);
            alert(`Failed to generate PDF: ${error.message}`);
        }
    };

    const exportToCSV = () => {
        try {
            if (!ttData || !filteredSlots.length) {
                alert('No timetable data to export');
                return;
            }

            // Calculate time slots
            const calculateTimeSlot = (slotIndex) => {
                let currentTime = new Date();
                currentTime.setHours(8, 30, 0);
                currentTime.setMinutes(currentTime.getMinutes() + (slotIndex * 60));

                const formatTime = (date) => {
                    const hours = date.getHours();
                    const minutes = date.getMinutes();
                    return `${hours}:${minutes.toString().padStart(2, '0')}`;
                };

                const start = formatTime(currentTime);
                currentTime.setMinutes(currentTime.getMinutes() + 60);
                const end = formatTime(currentTime);
                return `${start}-${end}`;
            };
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const maxSlots = 8;
            let csv = '';

            // Group slots by section
            const slotsBySection = {};
            filteredSlots.forEach(s => {
                const key = s.section_id || 'na';
                if (!slotsBySection[key]) slotsBySection[key] = { name: s.section_name || `Section ${key}`, slots: [] };
                slotsBySection[key].slots.push(s);
            });

            Object.values(slotsBySection).forEach(section => {
                csv += `\n${section.name}\n`;
                csv += 'Day,Slot 1,Slot 2,Slot 3,Slot 4,Slot 5,Slot 6,Slot 7,Slot 8\n';

                for (let d = 0; d < 5; d++) {
                    csv += days[d];
                    for (let s = 0; s < maxSlots; s++) {
                        const slot = section.slots.find(sl => sl.day === d && sl.slot_index === s);
                        if (slot && !slot.is_break) {
                            const instructorName = slot.is_lab ? slot.lab_engineer_name : slot.teacher_name;
                            const text = `"${slot.subject_code || ''} ${instructorName || ''}${slot.is_lab ? ' (Lab)' : ''} ${slot.room_name || ''}"`;
                            csv += ',' + text;
                        } else if (slot && slot.is_break) {
                            csv += ',Break';
                        } else {
                            csv += ',-';
                        }
                    }
                    csv += '\n';
                }
                csv += '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const deptName = departments.find(d => d.id === parseInt(selectedDept))?.code || 'Timetable';
            a.download = `${deptName}_${ttData.name}_Admin.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('CSV export error:', error);
            alert(`Failed to export CSV: ${error.message}`);
        }
    };

    const exportToICal = () => {
        try {
            if (!ttData || !filteredSlots.length) {
                alert('No timetable data to export');
                return;
            }

            const calendar = ical({ name: 'QUEST Timetable - Admin View' });

            // Get current week's Monday
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(now.setDate(diff));
            monday.setHours(0, 0, 0, 0);

            filteredSlots.forEach(slot => {
                if (slot.is_break || !slot.subject_code) return;

                const eventDate = new Date(monday);
                eventDate.setDate(monday.getDate() + slot.day);

                const startHour = 8;
                const startMinute = 30 + (slot.slot_index * 60);
                const actualStartHour = startHour + Math.floor(startMinute / 60);
                const actualStartMinute = startMinute % 60;

                const start = new Date(eventDate);
                start.setHours(actualStartHour, actualStartMinute, 0);

                const end = new Date(start);
                end.setMinutes(end.getMinutes() + (slot.is_lab ? 180 : 60));

                calendar.createEvent({
                    start: start,
                    end: end,
                    summary: `${slot.subject_code}${slot.is_lab ? ' (Lab)' : ''} - ${slot.section_name}`,
                    description: `${slot.is_lab ? 'Lab Engineer' : 'Teacher'}: ${slot.is_lab ? (slot.lab_engineer_name || 'TBA') : (slot.teacher_name || 'TBA')}\nRoom: ${slot.room_name || 'TBA'}`,
                    location: slot.room_name || '',
                    repeating: {
                        freq: 'WEEKLY',
                        count: 16
                    }
                });
            });

            const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const deptName = departments.find(d => d.id === parseInt(selectedDept))?.code || 'Timetable';
            a.download = `${deptName}_${ttData.name}_Admin.ics`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('iCal export error:', error);
            alert(`Failed to export iCal: ${error.message}`);
        }
    };

    // Group filtered slots by section
    const slotsBySection = {};
    filteredSlots.forEach(s => {
        const key = s.section_id || 'na';
        if (!slotsBySection[key]) slotsBySection[key] = { name: s.section_name || `Section ${key}`, slots: [] };
        slotsBySection[key].slots.push(s);
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Timetable Management</h1>
                    <p className="text-sm text-slate-500">{timetables.length} timetables created</p>
                </div>
            </div>

            {/* Generate Section (admin only) */}
            {isAdmin && (
                <div className="glass p-5">
                    <h2 className="text-sm font-bold text-slate-800 mb-3">Generate New Timetable</h2>
                    <div className="flex gap-3 flex-wrap">
                        <select
                            value={genSessionId}
                            onChange={e => setGenSessionId(e.target.value)}
                            className="flex-1 min-w-[200px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                       text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                        >
                            <option value="">Select Session to Generate</option>
                            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Custom Timetable Name (Optional)"
                            value={timetableName}
                            onChange={(e) => setTimetableName(e.target.value)}
                            className="flex-1 min-w-[200px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800
                                       text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="flex items-center gap-2 px-5 py-2 gradient-accent text-white rounded-xl
                                       text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity
                                       shadow-md shadow-primary-500/20"
                        >
                            <HiOutlineRefresh className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                            {generating ? 'Generating...' : 'Generate'}
                        </button>
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors"
                        >
                            {showAdvanced ? 'Hide Settings' : 'Settings'}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="mt-4 space-y-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                            {/* Incremental Generation Target */}
                            <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl mb-4">
                                <label className="block text-[10px] font-bold text-primary-600 uppercase mb-2 ml-1">
                                    Target Timetable (Incremental Mode)
                                </label>
                                <select
                                    value={genTargetTTId}
                                    onChange={e => setGenTargetTTId(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-primary-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                >
                                    <option value="">🆕 Create New Timetable</option>
                                    {timetables
                                        .filter(t => t.status !== 'archived' && (!user?.department_id || t.department_id === user.department_id))
                                        .map(t => (
                                            <option key={t.id} value={t.id}>➕ Add to: {t.name} ({t.semester_info})</option>
                                        ))
                                    }
                                </select>
                                <p className="text-[10px] text-primary-500 mt-1.5 ml-1">
                                    Selecting an existing timetable will append the new batches to it while avoiding conflicts with existing classes.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Semester</label>
                                    <select
                                        value={semesterType}
                                        onChange={e => setSemesterType(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                    >
                                        <option value="Fall">Fall</option>
                                        <option value="Spring">Spring</option>
                                        <option value="Summer">Summer</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Extra Classes / Week</label>
                                    <input
                                        type="number"
                                        value={extraClasses}
                                        onChange={e => setExtraClasses(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Class Duration (min)</label>
                                    <input
                                        type="number"
                                        value={classDuration}
                                        onChange={e => setClassDuration(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-6 items-start">
                                <div className="flex-1 min-w-[300px] space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                                        Target Batches (Bulk if none selected)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {batches.length === 0 ? (
                                            <span className="text-xs text-slate-400 italic">No batches available</span>
                                        ) : (
                                            batches
                                                .filter(b => !user?.department_id || b.department_id === user.department_id)
                                                .map(b => (
                                                    <button
                                                        key={b.id}
                                                        type="button"
                                                        onClick={() => toggleGenBatch(b.id)}
                                                        title={getModeTooltip(b)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${genBatchIds.includes(b.id)
                                                            ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                                                            }`}
                                                    >
                                                        {b.display_name}
                                                        {b.morning_lab_mode && (
                                                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${genBatchIds.includes(b.id)
                                                                ? 'bg-white/20 border-white/30 text-white'
                                                                : getModeColor(b.morning_lab_mode)
                                                                }`}>
                                                                {b.morning_lab_mode === 'strict' && '🌅'}
                                                                {b.morning_lab_mode === 'prefer' && '☀️'}
                                                                {b.morning_lab_mode === 'count' && `📊${b.morning_lab_count || 0}`}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))
                                        )}
                                    </div>
                                    
                                    {/* Sequential Mode Toggle */}
                                    {genBatchIds.length > 1 && (
                                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    id="sequentialMode"
                                                    checked={sequentialMode}
                                                    onChange={(e) => setSequentialMode(e.target.checked)}
                                                    className="mt-0.5 w-4 h-4 text-amber-600 bg-white border-amber-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <label htmlFor="sequentialMode" className="text-xs font-bold text-amber-800 uppercase cursor-pointer block mb-1">
                                                        🔄 Sequential Batch-wise Generation
                                                    </label>
                                                    <p className="text-[10px] text-amber-700 leading-relaxed">
                                                        Process batches one by one in the selected order. This reduces solver complexity and makes it easier to find solutions when generating all batches together fails. Each batch is solved independently, then committed before moving to the next.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Max Slots / Day</label>
                                        <input
                                            type="number"
                                            value={maxSlotsPerDay}
                                            onChange={e => setMaxSlotsPerDay(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Max Slots Friday</label>
                                        <input
                                            type="number"
                                            value={maxSlotsFriday}
                                            onChange={e => setMaxSlotsFriday(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Break After Slot</label>
                                        <select
                                            value={breakSlot}
                                            onChange={e => setBreakSlot(parseInt(e.target.value))}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                        >
                                            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <option key={i} value={i}>Slot #{i + 1}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Start Time</label>
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Break Duration (min)</label>
                                        <input
                                            type="number"
                                            value={breakDuration}
                                            onChange={e => setBreakDuration(parseInt(e.target.value))}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-primary-400"
                                        />
                                    </div>
                                </div>

                                {/* Break Calculation Info */}
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                    <p className="text-xs text-blue-800 font-medium">
                                        ℹ️ Break will be placed after slot {breakSlot + 1} ({calculateBreakTimes().breakStart} - {calculateBreakTimes().breakEnd})
                                    </p>
                                </div>
                            </div>

                            {/* Early Finish Classes Configuration */}
                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="earlyFinishClasses"
                                        checked={earlyFinishClasses}
                                        onChange={(e) => setEarlyFinishClasses(e.target.checked)}
                                        className="w-4 h-4 text-primary-600 bg-slate-50 border-slate-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
                                    />
                                    <label htmlFor="earlyFinishClasses" className="text-xs font-bold text-slate-600 uppercase cursor-pointer">
                                        Early Finish Classes (Uniform Lab Starts)
                                    </label>
                                </div>

                                {earlyFinishClasses && (
                                    <div className="ml-7 p-3 bg-slate-100/50 rounded-lg border border-slate-200 animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">
                                            Select Batches for Uniform Lab Starts
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {batches.length === 0 ? (
                                                <span className="text-xs text-slate-400 italic">No batches available</span>
                                            ) : (
                                                batches
                                                    .filter(b => !user?.department_id || b.department_id === user.department_id)
                                                    .map(b => (
                                                        <button
                                                            key={`ef-${b.id}`}
                                                            type="button"
                                                            onClick={() => setEarlyFinishBatchIds(prev =>
                                                                prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                                                            )}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${earlyFinishBatchIds.includes(b.id)
                                                                ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                                                                }`}
                                                        >
                                                            {b.display_name}
                                                        </button>
                                                    ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-800 font-medium">
                                        ℹ️ Morning lab settings are configured in the <a href="/restrictions" className="underline hover:text-blue-600">Restrictions/Settings page</a>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="fridayBreakGen"
                                    checked={fridayHasBreak}
                                    onChange={e => setFridayHasBreak(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="fridayBreakGen" className="text-xs font-bold text-slate-600 uppercase">Friday Has Break</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="allowFridayLabs"
                                    checked={allowFridayLabs}
                                    onChange={e => setAllowFridayLabs(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="allowFridayLabs" className="text-xs font-bold text-slate-600 uppercase">Allow Labs on Friday</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="preferEarlyDismissal"
                                    checked={preferEarlyDismissal}
                                    onChange={e => setPreferEarlyDismissal(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="preferEarlyDismissal" className="text-xs font-bold text-slate-600 uppercase">Prefer Early Dismissal (Mon-Thu)</label>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="labIsLast"
                                    checked={labIsLast}
                                    onChange={(e) => setLabIsLast(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 bg-slate-50 border-slate-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
                                />
                                <label htmlFor="labIsLast" className="text-xs font-bold text-slate-600 uppercase">Lab is Last (No theory after afternoon lab)</label>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Redesigned Selector */}
            <div className="glass p-5">
                <div className="flex flex-wrap items-end gap-6">
                    {/* Department Selector */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Department</label>
                        <select
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            className="w-[200px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                        >
                            <option value="">Select Department</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    {/* Generation Error Modal */}
                    {generationError && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
                                    <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Generation Failed
                                    </h3>
                                    <button
                                        onClick={() => setGenerationError(null)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-sm text-slate-700 whitespace-pre-wrap">
                                        {generationError}
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                                    <button
                                        onClick={() => setGenerationError(null)}
                                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Progress Modal */}
                    {showProgressModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-primary-50 to-blue-50">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Generating Timetable
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">This may take a few moments...</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    {/* Progress Steps */}
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Loading assignments', icon: '📚' },
                                            { label: 'Building constraints', icon: '🔧' },
                                            { label: 'Solving schedule', icon: '🧮' },
                                            { label: 'Saving timetable', icon: '💾' },
                                            { label: 'Complete!', icon: '✅' }
                                        ].map((step, idx) => (
                                            <div key={idx} className={`flex items-center gap-3 transition-all duration-300 ${
                                                progressStep >= idx ? 'opacity-100' : 'opacity-30'
                                            }`}>
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                                                    progressStep > idx 
                                                        ? 'bg-green-100 text-green-600' 
                                                        : progressStep === idx 
                                                        ? 'bg-primary-100 text-primary-600 animate-pulse' 
                                                        : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    {progressStep > idx ? '✓' : step.icon}
                                                </div>
                                                <span className={`text-sm font-medium transition-colors ${
                                                    progressStep >= idx ? 'text-slate-700' : 'text-slate-400'
                                                }`}>
                                                    {step.label}
                                                </span>
                                                {progressStep === idx && (
                                                    <div className="ml-auto">
                                                        <div className="flex gap-1">
                                                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    <div className="pt-2">
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-primary-500 to-blue-500 transition-all duration-500 ease-out"
                                                style={{ width: `${(progressStep / 4) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Version Selector */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Archive</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setSelectedVersion('latest')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedVersion === 'latest' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Latest
                            </button>
                            <button
                                onClick={() => setSelectedVersion('previous')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedVersion === 'previous' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Previous
                            </button>
                        </div>
                        {selectedVersion === 'previous' && (() => {
                            const archivedTTs = timetables
                                .filter(t => t.department_id === parseInt(selectedDept) && t.status === 'archived');
                            return archivedTTs.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    <select
                                        value={selectedArchiveTT}
                                        onChange={e => setSelectedArchiveTT(e.target.value)}
                                        className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/20"
                                    >
                                        {archivedTTs.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} — {t.semester_info || t.created_at?.split(' ')[0]}</option>
                                        ))}
                                    </select>
                                    {isAdmin && (isSuperAdmin || (selectedDept === user?.department_id?.toString())) && (
                                        <button
                                            onClick={() => handleRestore(selectedArchiveTT)}
                                            className="px-3 py-1.5 bg-primary-100 text-primary-600 rounded-lg text-[10px] font-black uppercase tracking-tight hover:bg-primary-200 transition-colors"
                                        >
                                            Restore as Latest
                                        </button>
                                    )}
                                </div>
                            ) : <span className="text-xs text-slate-400 italic mt-2 block">No archived timetables yet</span>;
                        })()}
                    </div>

                    {/* Batch Selector (Filters the active TT) */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Filter by Batch</label>
                        <select
                            value={selectedBatchId}
                            onChange={e => {
                                setSelectedBatchId(e.target.value);
                                handleFilter(e.target.value ? 'section' : ''); // This will be handled in a filteredSlots logic update
                            }}
                            className="w-[180px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                        >
                            <option value="">All Batches</option>
                            {batches.filter(b => !selectedDept || b.department_id === parseInt(selectedDept)).map(b => (
                                <option key={b.id} value={b.id}>{b.display_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Export Buttons */}
                    {ttData && filteredSlots.length > 0 && (
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-500">Export:</span>
                            <button
                                onClick={exportToPDF}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors shadow-md">
                                📄 PDF
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-md">
                                📊 CSV
                            </button>
                            <button
                                onClick={exportToICal}
                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-md">
                                📅 iCal
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-3 ml-auto mb-1">
                        {activeTT && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">"{ttData?.name}"</span>
                                {isAdmin && (isSuperAdmin || ttData?.department_id === user?.department_id) && (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleRename(activeTT, ttData.name)}
                                            className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-all"
                                        >
                                            <HiOutlinePencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(activeTT)}
                                            className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTT && (
                            <button onClick={handleExport}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-600
                                               bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm shadow-emerald-500/10">
                                <HiOutlineDownload className="w-4 h-4" /> Export Excel
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Active Timetable Batch Management */}
            {activeTT && ttData && (
                <div className="glass p-4 bg-slate-50/50 border-dashed border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                            Batches in this Timetable: {(() => {
                                const activeBatchIds = Array.from(new Set(ttData.slots?.filter(s => !s.is_break).map(s => {
                                    const sec = sections.find(sc => sc.id === s.section_id);
                                    return sec?.batch_id;
                                }).filter(id => id)));
                                
                                const batchNames = activeBatchIds
                                    .map(bid => batches.find(b => b.id === bid)?.display_name)
                                    .filter(name => name)
                                    .join(', ');
                                
                                return batchNames || 'None';
                            })()}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {Array.from(new Set(ttData.slots?.filter(s => !s.is_break).map(s => {
                                const sec = sections.find(sc => sc.id === s.section_id);
                                return sec?.batch_id;
                            }).filter(id => id))).length} Batches Included
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(() => {
                            const activeBatchIds = Array.from(new Set(ttData.slots?.filter(s => !s.is_break).map(s => {
                                const sec = sections.find(sc => sc.id === s.section_id);
                                return sec?.batch_id;
                            }).filter(id => id)));

                            return activeBatchIds.map(bid => {
                                const batch = batches.find(b => b.id === bid);
                                if (!batch) return null;
                                return (
                                    <div key={`manage-${bid}`} className="flex items-center gap-1 pl-3 pr-1 py-1 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-primary-200 transition-colors">
                                        <span className="text-xs font-bold text-slate-700">{batch.display_name}</span>
                                        {isAdmin && (isSuperAdmin || ttData.department_id === user?.department_id) && (
                                            <button
                                                onClick={() => handleRemoveBatch(bid)}
                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Remove this batch from timetable"
                                            >
                                                <HiOutlineTrash className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {/* Timetable Grids */}
            {ttData && (ttData.status === 'generated' || ttData.status === 'archived') && Object.keys(slotsBySection).length > 0 ? (
                <div className="space-y-4">
                    {Object.entries(slotsBySection).map(([sid, data]) => (
                        <TimetableGrid key={sid} sectionName={data.name} slots={data.slots} timetable={ttData} />
                    ))}
                </div>
            ) : ttData && (ttData.status === 'empty' || ttData.status === 'infeasible') ? (
                <div className="glass p-12 text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h3 className="text-lg font-semibold text-red-500 mb-2">Timetable Infeasible</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                        The solver couldn't find a valid schedule. This usually means teacher assignments
                        exceed available time slots. Try reducing assignments or adding more rooms.
                    </p>
                </div>
            ) : timetables.length === 0 ? (
                <div className="glass p-12 text-center">
                    <div className="text-5xl mb-4">📅</div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No Timetables Yet</h3>
                    <p className="text-sm text-slate-500">
                        Generate your first timetable using the form above.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
