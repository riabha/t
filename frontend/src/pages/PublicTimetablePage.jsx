import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import TimetableGrid from '../components/TimetableGrid';
import {
    HiOutlineAcademicCap, HiOutlineCalendar, HiOutlineExternalLink,
    HiOutlineFilter, HiOutlineUserGroup, HiOutlineBookOpen,
    HiOutlineOfficeBuilding, HiOutlineInformationCircle, HiOutlineSearch
} from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ical from 'ical-generator';

const API_BASE = '/api/public';

export default function PublicTimetablePage() {
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedVersion, setSelectedVersion] = useState('latest'); // 'latest' or 'previous'
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [selectedArchiveTT, setSelectedArchiveTT] = useState('');
    const [departments, setDepartments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [timetableData, setTimetableData] = useState(null);
    const [allTimetableData, setAllTimetableData] = useState(null); // For search across all departments
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ faculty: 0, courses: 0, departments: 0, dept_codes: [] });
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    
    // View mode state
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'daily'

    useEffect(() => {
        const init = async () => {
            try {
                const [deptRes, batchRes, ttRes, statsRes] = await Promise.all([
                    axios.get(`${API_BASE}/departments`),
                    axios.get(`${API_BASE}/batches`),
                    axios.get(`${API_BASE}/timetables`),
                    axios.get(`${API_BASE}/stats`)
                ]);
                setDepartments(deptRes.data);
                const flattenedBatches = Object.values(batchRes.data).flat();
                setBatches(flattenedBatches);
                setTimetables(ttRes.data);
                setStats(statsRes.data);

                if (deptRes.data.length > 0) {
                    setSelectedDept(deptRes.data[0].id.toString());
                } else {
                    setLoading(false);
                }
            } catch (err) { console.error(err); setLoading(false); }
        };
        init();
    }, []);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.search-container')) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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
                    setTimetableData(null);
                    setLoading(false);
                }
            } else if (selectedArchiveTT) {
                loadTimetable(parseInt(selectedArchiveTT));
            } else if (archivedTTs.length > 0) {
                setSelectedArchiveTT(archivedTTs[0].id.toString());
            } else {
                setTimetableData(null);
                setLoading(false);
            }
        } else if (timetables.length > 0 && !selectedDept) {
            setTimetableData(null);
        }
    }, [selectedDept, selectedVersion, selectedArchiveTT, selectedBatchId, timetables]);

    const loadTimetable = async (ttId) => {
        setLoading(true);
        try {
            const params = {};
            if (selectedDept) params.dept_id = parseInt(selectedDept);
            const selBatch = batches.find(b => b.id === parseInt(selectedBatchId));
            if (selBatch) params.batch_year = selBatch.year;
            const res = await axios.get(`${API_BASE}/timetables/${ttId}`, { params });
            setTimetableData(res.data);
            
            // Also load ALL data for search (without filters)
            if (!allTimetableData) {
                const allRes = await axios.get(`${API_BASE}/timetables/${ttId}`);
                setAllTimetableData(allRes.data);
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const filteredGridData = () => {
        if (!timetableData || !timetableData.departments) return [];

        let depts = JSON.parse(JSON.stringify(timetableData.departments));

        if (selectedBatchId) {
            depts = depts.map(dept => ({
                ...dept,
                sections: dept.sections.filter(sec => {
                    // This assumes section.batch_id is available in the public response
                    // If not, we might need to filter slots inside TimetableGrid or update API
                    // For now, let's filter by matching section name if it contains batch display name
                    const batch = batches.find(b => b.id === parseInt(selectedBatchId));
                    return batch ? sec.name.includes(batch.display_name) : true;
                })
            })).filter(dept => dept.sections.length > 0);
        }

        return depts;
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const gridData = filteredGridData();
            if (gridData.length === 0) {
                alert('No timetable data to export');
                return;
            }

            // Get timing configuration from timetable data
            const startTime = timetableData?.start_time || "08:30";
            const breakStartTime = timetableData?.break_start_time || "10:30";
            const breakEndTime = timetableData?.break_end_time || "11:00";
            const breakSlot = timetableData?.break_slot ?? 2;
            const classDuration = timetableData?.class_duration || 60;

            // Calculate time slots using timetable configuration
            const calculateTimeSlot = (slotIndex) => {
                // Parse start time
                const [startH, startM] = startTime.split(':').map(Number);
                let currentTime = new Date();
                currentTime.setHours(startH, startM, 0);
                
                // Add duration for each slot before this one
                for (let i = 0; i < slotIndex; i++) {
                    if (i === breakSlot) {
                        // Add break duration
                        const [bStartH, bStartM] = breakStartTime.split(':').map(Number);
                        const [bEndH, bEndM] = breakEndTime.split(':').map(Number);
                        const breakDuration = (bEndH * 60 + bEndM) - (bStartH * 60 + bStartM);
                        currentTime.setMinutes(currentTime.getMinutes() + breakDuration);
                    } else {
                        currentTime.setMinutes(currentTime.getMinutes() + classDuration);
                    }
                }

                const formatTime = (date) => {
                    const hours = date.getHours();
                    const minutes = date.getMinutes();
                    return `${hours}:${minutes.toString().padStart(2, '0')}`;
                };

                const start = formatTime(currentTime);
                
                // Add class duration for end time
                if (slotIndex === breakSlot) {
                    return `${breakStartTime}-${breakEndTime}`;
                } else {
                    currentTime.setMinutes(currentTime.getMinutes() + classDuration);
                    const end = formatTime(currentTime);
                    return `${start}-${end}`;
                }
            };

            let isFirstPage = true;

            gridData.forEach(dept => {
                dept.sections.forEach(section => {
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
                    doc.text(`${sectionTitle} - ${dept.name}`, 14, 36);

                    // Create time slot headers
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                    const maxSlots = timetableData?.max_slots_per_day || 8;
                    const timeHeaders = ['Day'];
                    for (let s = 0; s < maxSlots; s++) {
                        if (s === breakSlot) { // Break slot from timetable config
                            timeHeaders.push(`${breakStartTime}-${breakEndTime}\nBreak`);
                        } else {
                            timeHeaders.push(calculateTimeSlot(s));
                        }
                    }

                    // Prepare table data - only subject codes
                    const tableData = [];
                    const subjectDetails = {}; // For legend

                    for (let d = 0; d < 5; d++) {
                        const row = [days[d]];
                        for (let s = 0; s < maxSlots; s++) {
                            const slot = section.slots.find(sl => sl.day === d && sl.slot_index === s);
                            if (slot && !slot.is_break) {
                                if (slot.label && (slot.label === 'FYP-I' || slot.label === 'FYP-II')) {
                                    row.push(slot.label);
                                } else if (slot.subject_code) {
                                    row.push(slot.subject_code + (slot.is_lab ? '\n(Lab)' : ''));

                                    // Collect subject details for legend - accumulate both teacher and lab engineer
                                    if (!subjectDetails[slot.subject_code]) {
                                        subjectDetails[slot.subject_code] = {
                                            name: slot.subject_name || slot.subject_code,
                                            teacher: null,
                                            labEngineer: null,
                                            theoryCredits: slot.theory_credits || 3,
                                            labCredits: slot.lab_credits || 0
                                        };
                                    }

                                    // Update details based on slot type
                                    if (slot.is_lab) {
                                        if (slot.lab_engineer_name) {
                                            subjectDetails[slot.subject_code].labEngineer = slot.lab_engineer_name;
                                        }
                                    } else {
                                        if (slot.teacher_name) {
                                            subjectDetails[slot.subject_code].teacher = slot.teacher_name;
                                        }
                                    }
                                } else {
                                    row.push('-');
                                }
                            } else if (slot && slot.is_break) {
                                row.push('Break');
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
                    const deptName = departments.find(d => d.id === parseInt(selectedDept))?.name || dept.name || 'Concerned Department';
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
            });

            const deptName = departments.find(d => d.id === parseInt(selectedDept))?.code || 'Timetable';
            doc.save(`${deptName}_Timetable.pdf`);
            console.log('PDF generated successfully!');
        } catch (error) {
            console.error('PDF generation error:', error);
            alert(`Failed to generate PDF: ${error.message}`);
        }
    };

    const exportToCSV = () => {
        try {
            const gridData = filteredGridData();
            if (gridData.length === 0) {
                alert('No timetable data to export');
                return;
            }

            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const maxSlots = 8;
            let csv = '';

            gridData.forEach(dept => {
                dept.sections.forEach(section => {
                    csv += `\n${section.name} - ${dept.name}\n`;
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
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const deptName = departments.find(d => d.id === parseInt(selectedDept))?.code || 'Timetable';
            a.download = `${deptName}_Timetable.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('CSV export error:', error);
            alert(`Failed to export CSV: ${error.message}`);
        }
    };

    const exportToICal = () => {
        try {
            const gridData = filteredGridData();
            if (gridData.length === 0) {
                alert('No timetable data to export');
                return;
            }

            const calendar = ical({ name: 'QUEST Timetable' });

            // Get current week's Monday
            const now = new Date();
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(now.setDate(diff));
            monday.setHours(0, 0, 0, 0);

            gridData.forEach(dept => {
                dept.sections.forEach(section => {
                    section.slots.forEach(slot => {
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
                            summary: `${slot.subject_code}${slot.is_lab ? ' (Lab)' : ''} - ${section.name}`,
                            description: `${slot.is_lab ? 'Lab Engineer' : 'Teacher'}: ${slot.is_lab ? (slot.lab_engineer_name || 'TBA') : (slot.teacher_name || 'TBA')}\nRoom: ${slot.room_name || 'TBA'}\nDepartment: ${dept.name}`,
                            location: slot.room_name || '',
                            repeating: {
                                freq: 'WEEKLY',
                                count: 16
                            }
                        });
                    });
                });
            });

            const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const deptName = departments.find(d => d.id === parseInt(selectedDept))?.code || 'Timetable';
            a.download = `${deptName}_Timetable.ics`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('iCal export error:', error);
            alert(`Failed to export iCal: ${error.message}`);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        
        // Use allTimetableData for search (contains all departments)
        if (!query.trim() || !allTimetableData) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const results = [];
        const lowerQuery = query.toLowerCase();

        // Search through ALL departments (from allTimetableData)
        if (allTimetableData && allTimetableData.departments) {
            allTimetableData.departments.forEach(dept => {
                dept.sections.forEach(section => {
                    // Match section name
                    if (section.name.toLowerCase().includes(lowerQuery)) {
                        results.push({
                            type: 'section',
                            title: section.name,
                            subtitle: dept.name,
                            sectionId: section.section_id,
                            deptId: dept.id
                        });
                    }

                    // Search through slots for teachers and subjects
                    const uniqueTeachers = new Set();
                    const uniqueSubjects = new Set();

                    section.slots.forEach(slot => {
                        if (!slot.is_break) {
                            // Match teacher name (for theory classes)
                            if (!slot.is_lab && slot.teacher_name && slot.teacher_name.toLowerCase().includes(lowerQuery)) {
                                const key = `${slot.teacher_name}-${section.section_id}`;
                                if (!uniqueTeachers.has(key)) {
                                    uniqueTeachers.add(key);
                                    results.push({
                                        type: 'teacher',
                                        title: slot.teacher_name,
                                        subtitle: `${section.name} - ${slot.subject_code || 'Unknown'}`,
                                        sectionId: section.section_id,
                                        deptId: dept.id
                                    });
                                }
                            }

                            // Match lab engineer name
                            if (slot.lab_engineer_name && slot.lab_engineer_name.toLowerCase().includes(lowerQuery)) {
                                const key = `${slot.lab_engineer_name}-${section.section_id}`;
                                if (!uniqueTeachers.has(key)) {
                                    uniqueTeachers.add(key);
                                    results.push({
                                        type: 'teacher',
                                        title: slot.lab_engineer_name,
                                        subtitle: `${section.name} - ${slot.subject_code || 'Unknown'} (Lab)`,
                                        sectionId: section.section_id,
                                        deptId: dept.id
                                    });
                                }
                            }

                            // Match subject code or name
                            if (slot.subject_code && slot.subject_code.toLowerCase().includes(lowerQuery)) {
                                const key = `${slot.subject_code}-${section.section_id}`;
                                if (!uniqueSubjects.has(key)) {
                                    uniqueSubjects.add(key);
                                    results.push({
                                        type: 'subject',
                                        title: slot.subject_code,
                                        subtitle: `${section.name} - ${slot.subject_name || slot.subject_code}`,
                                        sectionId: section.section_id,
                                        deptId: dept.id
                                    });
                                }
                            }
                        }
                    });
                });
            });
        }

        setSearchResults(results.slice(0, 10)); // Limit to 10 results
        setShowSearchResults(true);
    };

    const handleSearchResultClick = (result) => {
        // Change department filter if needed
        if (result.deptId && result.deptId.toString() !== selectedDept) {
            setSelectedDept(result.deptId.toString());
            setSelectedBatchId(''); // Reset batch filter
        }
        
        // Wait for state update, then scroll
        setTimeout(() => {
            const sectionElement = document.getElementById(`section-${result.sectionId}`);
            if (sectionElement) {
                sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight the section briefly
                sectionElement.classList.add('ring-4', 'ring-blue-500', 'ring-offset-4');
                setTimeout(() => {
                    sectionElement.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-4');
                }, 2000);
            }
        }, 300);
        
        setShowSearchResults(false);
        setSearchQuery('');
    };

    // Get current day and slot based on time
    const getCurrentDayAndSlot = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, etc.
        
        // Convert to our day index (0=Monday, 4=Friday)
        let dayIndex = dayOfWeek - 1;
        if (dayIndex < 0 || dayIndex > 4) {
            return { day: null, slot: null, isWeekend: true };
        }

        // Get current time in minutes since midnight
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        // Parse start time from timetable config
        const startTime = timetableData?.start_time || "08:30";
        const [startH, startM] = startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        
        const classDuration = timetableData?.class_duration || 60;
        const breakSlot = timetableData?.break_slot ?? 2;
        
        // Calculate break duration
        const breakStart = timetableData?.break_start_time || "10:30";
        const breakEnd = timetableData?.break_end_time || "11:00";
        const [bStartH, bStartM] = breakStart.split(':').map(Number);
        const [bEndH, bEndM] = breakEnd.split(':').map(Number);
        const breakDuration = (bEndH * 60 + bEndM) - (bStartH * 60 + bStartM);

        // Calculate which slot we're in
        let slotIndex = null;
        let accumulatedMinutes = startMinutes;
        
        for (let i = 0; i < 8; i++) {
            const slotEnd = accumulatedMinutes + (i === breakSlot ? breakDuration : classDuration);
            
            if (currentMinutes >= accumulatedMinutes && currentMinutes < slotEnd) {
                slotIndex = i;
                break;
            }
            
            accumulatedMinutes = slotEnd;
        }

        return { day: dayIndex, slot: slotIndex, isWeekend: false };
    };

    // Get classes for daily view
    const getDailyClasses = () => {
        if (!timetableData || !timetableData.departments) return [];
        
        const { day, slot, isWeekend } = getCurrentDayAndSlot();
        
        if (isWeekend || day === null) {
            return [];
        }

        const classes = [];
        
        filteredGridData().forEach(dept => {
            dept.sections.forEach(section => {
                // Current class
                const currentSlot = section.slots.find(s => s.day === day && s.slot_index === slot && !s.is_break);
                if (currentSlot) {
                    classes.push({
                        type: 'current',
                        section: section.name,
                        department: dept.name,
                        subject: currentSlot.subject_code,
                        subjectName: currentSlot.subject_name,
                        teacher: currentSlot.is_lab ? currentSlot.lab_engineer_name : currentSlot.teacher_name,
                        room: currentSlot.room_name,
                        isLab: currentSlot.is_lab,
                        slot: slot
                    });
                }
                
                // Next class
                if (slot !== null) {
                    for (let nextSlot = slot + 1; nextSlot < 8; nextSlot++) {
                        const next = section.slots.find(s => s.day === day && s.slot_index === nextSlot && !s.is_break);
                        if (next) {
                            classes.push({
                                type: 'next',
                                section: section.name,
                                department: dept.name,
                                subject: next.subject_code,
                                subjectName: next.subject_name,
                                teacher: next.is_lab ? next.lab_engineer_name : next.teacher_name,
                                room: next.room_name,
                                isLab: next.is_lab,
                                slot: nextSlot
                            });
                            break;
                        }
                    }
                }
            });
        });

        return classes;
    };

    const dailyClasses = getDailyClasses();
    const currentClasses = dailyClasses.filter(c => c.type === 'current');
    const nextClasses = dailyClasses.filter(c => c.type === 'next');

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ═══════════ COLORFUL TOP BAR ═══════════ */}
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-violet-500 via-50% via-rose-500 to-amber-500" />

            {/* ═══════════ HEADER ═══════════ */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="QUEST Logo" className="w-12 h-12 object-contain" />
                            <div className="leading-tight">
                                <h1 className="font-display text-base font-extrabold text-slate-800">QUEST Timetable Portal</h1>
                                <p className="text-[10px] text-slate-400 font-medium">Quaid-e-Awam University · Civil Engineering</p>
                            </div>
                        </div>
                        <nav className="flex items-center gap-3">
                            <Link to="/faculty" className="hidden sm:flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium px-3 py-1.5">
                                <HiOutlineUserGroup className="w-4 h-4" /> Faculty
                            </Link>
                            <Link to="/about" className="hidden sm:flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium px-3 py-1.5">
                                <HiOutlineInformationCircle className="w-4 h-4" /> Guide
                            </Link>
                            <Link to="/login" className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg shadow-md shadow-blue-600/20 hover:shadow-lg transition-all">
                                Admin <HiOutlineExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* ═══════════ COMPACT HERO + FILTERS (above the fold) ═══════════ */}
            <div className="bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-6">
                        {/* Left — title area */}
                        <div className="flex-1">
                            <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight mb-1.5">
                                📅 Class Timetables
                            </h2>
                            <p className="text-blue-100 text-sm sm:text-base max-w-lg">
                                Find your weekly schedule — select your department and batch below.
                            </p>
                        </div>
                        {/* Right — quick stats */}
                        <div className="flex gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20">
                                <HiOutlineUserGroup className="w-4 h-4 text-amber-300" />
                                <span className="text-sm font-bold">{stats.faculty} Faculty</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20">
                                <HiOutlineBookOpen className="w-4 h-4 text-emerald-300" />
                                <span className="text-sm font-bold">{stats.courses} Courses</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20">
                                <HiOutlineOfficeBuilding className="w-4 h-4 text-rose-300" />
                                <span className="text-sm font-bold">{stats.departments} Departments</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20">
                                <HiOutlineCalendar className="w-4 h-4 text-cyan-300" />
                                <span className="text-sm font-bold">{timetables.length} Timetables Generated</span>
                            </div>
                        </div>
                    </div>

                    {/* ══════ SMART SEARCH BAR ══════ */}
                    <div className="mt-6 relative search-container">
                        <div className="relative">
                            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                onFocus={() => searchQuery && setShowSearchResults(true)}
                                placeholder="🔍 Quick Search: Type section (22CE-A), teacher name, or subject code..."
                                className="w-full pl-12 pr-4 py-4 bg-white text-slate-800 border-0 rounded-2xl text-sm font-medium shadow-2xl focus:ring-4 focus:ring-amber-400 transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>
                        
                        {/* Search Results Dropdown */}
                        {showSearchResults && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                                <div className="max-h-96 overflow-y-auto">
                                    {searchResults.map((result, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSearchResultClick(result)}
                                            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 flex items-center gap-3"
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                result.type === 'section' ? 'bg-blue-100' :
                                                result.type === 'teacher' ? 'bg-emerald-100' :
                                                'bg-violet-100'
                                            }`}>
                                                {result.type === 'section' && <HiOutlineAcademicCap className="w-5 h-5 text-blue-600" />}
                                                {result.type === 'teacher' && <HiOutlineUserGroup className="w-5 h-5 text-emerald-600" />}
                                                {result.type === 'subject' && <HiOutlineBookOpen className="w-5 h-5 text-violet-600" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-800 text-sm">{result.title}</div>
                                                <div className="text-xs text-slate-500">{result.subtitle}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {showSearchResults && searchQuery && searchResults.length === 0 && (
                            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 text-center">
                                <p className="text-sm text-slate-500">No results found for "{searchQuery}"</p>
                            </div>
                        )}
                    </div>

                    {/* ── Filters — Redesigned ── */}
                    <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 sm:p-6 shadow-2xl">
                        <div className="flex flex-col sm:flex-row gap-6 items-end">
                            {/* Department */}
                            <div className="flex-1 w-full">
                                <label className="block text-[11px] font-black text-blue-200 uppercase tracking-widest mb-2 ml-1">Academic Department</label>
                                <select
                                    value={selectedDept}
                                    onChange={e => { setSelectedDept(e.target.value); setSelectedBatchId(''); }}
                                    className="w-full px-4 py-3 bg-white text-slate-800 border-0 rounded-xl text-sm font-bold shadow-lg focus:ring-4 focus:ring-amber-400 transition-all outline-none appearance-none"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Archive Version */}
                            <div className="w-full sm:w-auto">
                                <label className="block text-[11px] font-black text-blue-200 uppercase tracking-widest mb-2 ml-1 text-center sm:text-left">Version</label>
                                <div className="flex bg-white/20 p-1 rounded-xl backdrop-blur-sm border border-white/10">
                                    <button
                                        onClick={() => setSelectedVersion('latest')}
                                        className={`flex-1 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${selectedVersion === 'latest' ? 'bg-white text-blue-600 shadow-xl scale-105' : 'text-white hover:bg-white/10'}`}
                                    >
                                        Latest
                                    </button>
                                    <button
                                        onClick={() => setSelectedVersion('previous')}
                                        className={`flex-1 sm:px-6 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${selectedVersion === 'previous' ? 'bg-white text-blue-600 shadow-xl scale-105' : 'text-white hover:bg-white/10'}`}
                                    >
                                        Archive
                                    </button>
                                </div>
                                {/* Archive Session Picker — only visible when Archive is selected */}
                                {selectedVersion === 'previous' && (() => {
                                    const archiveTTs = timetables.filter(t => t.department_id === parseInt(selectedDept) && t.status === 'archived');
                                    return archiveTTs.length > 0 ? (
                                        <select
                                            value={selectedArchiveTT}
                                            onChange={e => setSelectedArchiveTT(e.target.value)}
                                            className="mt-2 sm:mt-0 w-full sm:w-auto px-4 py-2.5 bg-white text-slate-800 border-0 rounded-xl text-xs font-bold shadow-lg focus:ring-4 focus:ring-amber-400 transition-all outline-none appearance-none"
                                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                                        >
                                            {archiveTTs.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} — {t.semester_info || t.created_at?.split(' ')[0]}</option>
                                            ))}
                                        </select>
                                    ) : <span className="text-xs text-blue-200 italic mt-2 sm:mt-0">No archives yet</span>;
                                })()}
                            </div>

                            {/* Batch Filter */}
                            <div className="w-full sm:w-[220px]">
                                <label className="block text-[11px] font-black text-blue-200 uppercase tracking-widest mb-2 ml-1">Quick Batch Filter</label>
                                <select
                                    value={selectedBatchId}
                                    onChange={e => setSelectedBatchId(e.target.value)}
                                    className="w-full px-4 py-3 bg-white text-slate-800 border-0 rounded-xl text-sm font-bold shadow-lg focus:ring-4 focus:ring-amber-400 transition-all outline-none appearance-none disabled:opacity-50"
                                    disabled={!selectedDept}
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                                >
                                    <option value="">All Batches</option>
                                    {batches.filter(b => b.department_id === parseInt(selectedDept)).map(b => (
                                        <option key={b.id} value={b.id}>{b.display_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════ TIMETABLE CONTENT ═══════════ */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* View Toggle & Export Buttons */}
                {filteredGridData().length > 0 && (
                    <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700">View:</span>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'grid' 
                                            ? 'bg-white text-blue-600 shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-800'
                                    }`}
                                >
                                    📅 Full Grid
                                </button>
                                <button
                                    onClick={() => setViewMode('daily')}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'daily' 
                                            ? 'bg-white text-blue-600 shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-800'
                                    }`}
                                >
                                    📱 Daily View
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
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
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-slate-500 font-medium text-sm">Loading timetable...</p>
                    </div>
                ) : viewMode === 'daily' ? (
                    /* ═══════════ DAILY VIEW ═══════════ */
                    <div className="space-y-6">
                        {/* Current Time Info */}
                        <div className="bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-2xl p-6 shadow-lg">
                            <div className="flex items-center gap-3 mb-2">
                                <HiOutlineCalendar className="w-6 h-6" />
                                <h3 className="text-2xl font-bold">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </h3>
                            </div>
                            <p className="text-blue-100 text-sm">
                                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>

                        {getCurrentDayAndSlot().isWeekend ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
                                    <span className="text-4xl">🎉</span>
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">It's the Weekend!</h4>
                                <p className="text-slate-500">No classes scheduled. Enjoy your time off!</p>
                            </div>
                        ) : (
                            <>
                                {/* Current Classes */}
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                        Happening Now
                                    </h3>
                                    {currentClasses.length > 0 ? (
                                        <div className="space-y-3">
                                            {currentClasses.map((cls, idx) => (
                                                <div key={idx} className="bg-white rounded-xl border-2 border-green-200 p-4 shadow-sm">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <h4 className="font-bold text-lg text-slate-800">{cls.subject}</h4>
                                                            <p className="text-sm text-slate-600">{cls.subjectName}</p>
                                                        </div>
                                                        {cls.isLab && (
                                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                                                Lab
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Section</p>
                                                            <p className="font-bold text-slate-700">{cls.section}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Teacher</p>
                                                            <p className="font-bold text-slate-700">{cls.teacher}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Room</p>
                                                            <p className="font-bold text-slate-700">{cls.room || 'TBA'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Slot</p>
                                                            <p className="font-bold text-slate-700">Slot {cls.slot + 1}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                                            <p className="text-slate-500">No classes happening right now</p>
                                        </div>
                                    )}
                                </div>

                                {/* Next Classes */}
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <HiOutlineCalendar className="w-5 h-5 text-blue-600" />
                                        Coming Up Next
                                    </h3>
                                    {nextClasses.length > 0 ? (
                                        <div className="space-y-3">
                                            {nextClasses.map((cls, idx) => (
                                                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-300 transition-colors">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <h4 className="font-bold text-lg text-slate-800">{cls.subject}</h4>
                                                            <p className="text-sm text-slate-600">{cls.subjectName}</p>
                                                        </div>
                                                        {cls.isLab && (
                                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                                                Lab
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Section</p>
                                                            <p className="font-bold text-slate-700">{cls.section}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Teacher</p>
                                                            <p className="font-bold text-slate-700">{cls.teacher}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Room</p>
                                                            <p className="font-bold text-slate-700">{cls.room || 'TBA'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500 text-xs">Slot</p>
                                                            <p className="font-bold text-slate-700">Slot {cls.slot + 1}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                                            <p className="text-slate-500">No more classes today</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : filteredGridData().length > 0 ? (
                    /* ═══════════ GRID VIEW ═══════════ */
                    <div className="space-y-10">
                        {filteredGridData().map((dept, idx) => {
                            const colors = [
                                { bar: 'from-blue-500 to-blue-600', badge: 'bg-blue-100 text-blue-700' },
                                { bar: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
                                { bar: 'from-amber-500 to-amber-600', badge: 'bg-amber-100 text-amber-700' },
                                { bar: 'from-rose-500 to-rose-600', badge: 'bg-rose-100 text-rose-700' },
                                { bar: 'from-violet-500 to-violet-600', badge: 'bg-violet-100 text-violet-700' },
                            ];
                            const c = colors[idx % colors.length];
                            return (
                                <div key={dept.id}>
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className={`w-1.5 h-10 rounded-full bg-gradient-to-b ${c.bar}`} />
                                        <div>
                                            <h3 className="text-lg font-display font-bold text-slate-800">{dept.name}</h3>
                                            <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>{dept.code}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        {dept.sections.map(sec => (
                                            <div key={sec.section_id} id={`section-${sec.section_id}`} className="transition-all duration-300">
                                                <TimetableGrid 
                                                    sectionName={sec.name} 
                                                    slots={sec.slots} 
                                                    timetable={timetableData}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center mx-auto mb-4">
                            <HiOutlineSearch className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800">No Timetables Found</h4>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1.5 text-sm">Select a different department or timetable version above.</p>
                    </div>
                )}

                {/* ── Color legend ── */}
                <div className="mt-8 flex flex-wrap items-center gap-4 px-4 py-3 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-500">
                    <span className="font-bold text-slate-700">Legend:</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> Theory</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Lab / Practical</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-100 border border-violet-300" /> FYP</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" /> Break</span>
                </div>
            </main>

            {/* ═══════════ FOOTER ═══════════ */}
            <footer className="mt-8 border-t border-slate-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <img src="/logo.png" alt="QUEST Logo" className="w-6 h-6 object-contain" />
                            <span>© {new Date().getFullYear()} QUEST Timetable Portal</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>Developed by Prof. Dr. Riaz Bhanbhro</span>
                            <span className="text-slate-300">·</span>
                            <Link to="/about" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">About & Guide</Link>
                            <span className="text-slate-300">·</span>
                            <Link to="/login" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">Admin</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
