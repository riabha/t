import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
    HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineOfficeBuilding,
    HiOutlineCalendar, HiOutlineChartBar, HiOutlineClock,
    HiOutlineDownload, HiOutlineRefresh, HiOutlineEye, HiOutlineViewGrid,
    HiOutlineTable, HiOutlineTrendingUp, HiOutlineCheckCircle, HiOutlineExclamation
} from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function VCMasterDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    // Data states
    const [departments, setDepartments] = useState([]);
    const [timetables, setTimetables] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [stats, setStats] = useState({});
    
    // Processed data states
    const [allTimetableData, setAllTimetableData] = useState({});
    const [heatmapGrid, setHeatmapGrid] = useState([]);
    const [departmentStats, setDepartmentStats] = useState([]);
    const [liveClasses, setLiveClasses] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [todaySummary, setTodaySummary] = useState({});
    const [liveClassFilter, setLiveClassFilter] = useState('all');

    useEffect(() => {
        loadAllData();
    }, []);

    useEffect(() => {
        if (departments.length > 0 && timetables.length > 0) {
            processAllTimetables();
        }
    }, [departments, timetables]); // eslint-disable-line react-hooks/exhaustive-deps

    // Separate effect for live data auto-refresh
    useEffect(() => {
        if (departments.length > 0 && timetables.length > 0) {
            // Load immediately
            loadLiveData();
            // Then auto-refresh every 30 seconds
            const interval = setInterval(() => {
                console.log('Auto-refreshing live data...');
                loadLiveData();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [departments, timetables, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadAllData = async () => {
        try {
            const [deptsRes, ttsRes, teachersRes, subjectsRes, roomsRes] = await Promise.all([
                api.get('/departments/'),
                api.get('/timetable/list'),
                api.get('/teachers/'),
                api.get('/subjects/'),
                api.get('/rooms/')
            ]);

            setDepartments(deptsRes.data);
            setTimetables(ttsRes.data);
            setTeachers(teachersRes.data);
            setSubjects(subjectsRes.data);
            setRooms(roomsRes.data);

            calculateStats(deptsRes.data, ttsRes.data, teachersRes.data, subjectsRes.data, roomsRes.data);
            calculateDepartmentStats(deptsRes.data, ttsRes.data, teachersRes.data, subjectsRes.data, roomsRes.data);
            await loadLiveData();
        } catch (err) {
            console.error('Failed to load data:', err);
        }
        setLoading(false);
    };

    const processAllTimetables = async () => {
        const ttData = {};
        const heatmap = [];

        for (const dept of departments) {
            const deptTTs = timetables.filter(t => t.department_id === dept.id);
            const activeTT = deptTTs.find(t => t.status === 'active') || 
                            deptTTs.find(t => t.status === 'generated') ||
                            deptTTs[0];

            if (activeTT) {
                try {
                    const res = await api.get(`/timetable/${activeTT.id}`);
                    ttData[dept.id] = {
                        ...activeTT,
                        slots: res.data.slots || [],
                        sections: res.data.sections || []
                    };

                    // Group sections by batch (year)
                    const slots = res.data.slots || [];
                    const sections = res.data.sections || [];
                    
                    // Group sections by batch
                    const batchGroups = {};
                    sections.forEach(section => {
                        const batchYear = section.batch_year;
                        if (!batchGroups[batchYear]) {
                            batchGroups[batchYear] = [];
                        }
                        batchGroups[batchYear].push(section);
                    });

                    // Create a row for each batch
                    Object.entries(batchGroups).forEach(([batchYear, batchSections]) => {
                        // Sort sections by name
                        batchSections.sort((a, b) => a.display_name.localeCompare(b.display_name));
                        
                        // Create slot data with all sections in each slot
                        const slotData = Array(5).fill(null).map(() => 
                            Array(8).fill(null).map(() => [])
                        );
                        
                        // For each slot, collect classes from all sections in this batch
                        batchSections.forEach(section => {
                            const sectionSlots = slots.filter(s => s.section_id === section.id);
                            sectionSlots.forEach(slot => {
                                if (!slot.is_break && slot.day >= 0 && slot.day < 5 && slot.slot_index >= 0 && slot.slot_index < 8) {
                                    slotData[slot.day][slot.slot_index].push({
                                        subject_code: slot.subject_code,
                                        section_name: slot.section_name,
                                        section_id: section.id,
                                        is_lab: slot.is_lab,
                                        room_name: slot.room_name,
                                        teacher_name: slot.is_lab ? slot.lab_engineer_name : slot.teacher_name
                                    });
                                }
                            });
                        });

                        heatmap.push({
                            deptId: dept.id,
                            deptName: dept.name,
                            deptCode: dept.code,
                            batchYear: batchYear,
                            sections: batchSections.map(s => s.display_name),
                            sectionIds: batchSections.map(s => s.id),
                            slotData: slotData,
                            totalClasses: slots.filter(s => !s.is_break && batchSections.some(bs => bs.id === s.section_id)).length
                        });
                    });
                } catch (err) {
                    console.error(`Failed to load timetable for ${dept.name}:`, err);
                }
            }
        }

        setAllTimetableData(ttData);
        setHeatmapGrid(heatmap);
    };

    const loadLiveData = async () => {
        try {
            console.log('Loading live data...', { 
                timetablesCount: timetables.length, 
                departmentsCount: departments.length 
            });
            
            // Get ONLY the latest timetable per department (not all active/generated)
            const latestTimetables = [];
            for (const dept of departments) {
                const deptTTs = timetables.filter(t => t.department_id === dept.id);
                // Prioritize: latest > active > generated
                const latestTT = deptTTs.find(t => t.status === 'latest') || 
                                deptTTs.find(t => t.status === 'active') || 
                                deptTTs.find(t => t.status === 'generated');
                if (latestTT) {
                    latestTimetables.push(latestTT);
                }
            }
            
            console.log('Latest timetables per department:', latestTimetables.length);
            
            // Get start time from first timetable
            let startTime = "08:30"; // Default fallback
            if (latestTimetables.length > 0 && latestTimetables[0].start_time) {
                startTime = latestTimetables[0].start_time;
            }
            
            const { day, slot } = getCurrentDayAndSlot(startTime);
            
            console.log('Current day and slot:', { day, slot, startTime });
            
            if (day === null || slot === null) {
                console.log('No classes - outside school hours or weekend');
                setLiveClasses([]);
                calculateTodaySummary(day, [], startTime);
                return;
            }

            const allClasses = [];
            
            for (const tt of latestTimetables) {
                try {
                    const res = await api.get(`/timetable/${tt.id}`);
                    const slots = res.data.slots || [];
                    
                    const currentSlots = slots.filter(s => 
                        s.day === day && 
                        s.slot_index === slot && 
                        !s.is_break
                    );

                    console.log(`Timetable ${tt.id} (${tt.name}): ${currentSlots.length} classes in current slot`);

                    currentSlots.forEach(s => {
                        allClasses.push({
                            ...s,
                            timetable_name: tt.name,
                            department_name: departments.find(d => d.id === tt.department_id)?.name,
                            department_id: tt.department_id
                        });
                    });
                } catch (err) {
                    console.error(`Failed to load timetable ${tt.id}:`, err);
                }
            }

            console.log('Total live classes found:', allClasses.length);
            setLiveClasses(allClasses);
            calculateTodaySummary(day, allClasses, startTime);
        } catch (err) {
            console.error('Failed to load live data:', err);
        }
    };

    const getCurrentDayAndSlot = (startTime = "08:30") => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        let dayIndex = dayOfWeek - 1;
        
        if (dayIndex < 0 || dayIndex > 4) {
            return { day: null, slot: null };
        }

        // Parse start time (format: "HH:MM")
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const classDuration = 60;

        if (currentMinutes < startMinutes) {
            return { day: dayIndex, slot: null };
        }

        const slotIndex = Math.floor((currentMinutes - startMinutes) / classDuration);
        
        if (slotIndex >= 8) {
            return { day: dayIndex, slot: null };
        }

        return { day: dayIndex, slot: slotIndex };
    };

    const calculateStats = (depts, tts, teachers, subjects, rooms) => {
        const activeTTs = tts.filter(t => t.status === 'active' || t.status === 'generated');
        
        setStats({
            totalDepartments: depts.length,
            totalTeachers: teachers.filter(t => !t.is_lab_engineer).length,
            totalLabEngineers: teachers.filter(t => t.is_lab_engineer).length,
            totalSubjects: subjects.length,
            totalRooms: rooms.length,
            activeTimetables: activeTTs.length,
            archivedTimetables: tts.filter(t => t.status === 'archived').length
        });
    };

    const calculateDepartmentStats = (depts, tts, teachers, subjects, rooms) => {
        const deptStats = depts.map(dept => {
            const deptTeachers = teachers.filter(t => t.department_id === dept.id && !t.is_lab_engineer);
            const deptSubjects = subjects.filter(s => s.department_id === dept.id);
            const deptRooms = rooms.filter(r => r.department_id === dept.id);
            const deptTTs = tts.filter(t => t.department_id === dept.id && (t.status === 'active' || t.status === 'generated'));
            
            return {
                id: dept.id,
                name: dept.name,
                code: dept.code,
                teachers: deptTeachers.length,
                subjects: deptSubjects.length,
                rooms: deptRooms.length,
                timetables: deptTTs.length,
                hasActiveTimetable: deptTTs.length > 0
            };
        });
        
        setDepartmentStats(deptStats);
    };

    const calculateTodaySummary = (day, classes = [], startTime = "08:30") => {
        if (day === null) {
            setTodaySummary({ isWeekend: true });
            return;
        }

        const { slot: currentSlot } = getCurrentDayAndSlot(startTime);
        const totalSlots = 8;
        const completedSlots = currentSlot !== null ? currentSlot : 0;
        const remainingSlots = totalSlots - completedSlots;

        setTodaySummary({
            isWeekend: false,
            currentSlot,
            totalSlots,
            completedSlots,
            remainingSlots,
            activeClasses: classes.length,
            dayName: getDayName(day),
            startTime
        });
    };

    const getDayName = (index) => {
        return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][index] || '';
    };

    const getSlotTime = (index, startTime = "08:30") => {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const hour = startHour + Math.floor((startMinute + index * 60) / 60);
        const minute = (startMinute + index * 60) % 60;
        const endHour = startHour + Math.floor((startMinute + (index + 1) * 60) / 60);
        const endMinute = (startMinute + (index + 1) * 60) % 60;
        return `${hour}:${minute.toString().padStart(2, '0')} - ${endHour}:${endMinute.toString().padStart(2, '0')}`;
    };

    const getHeatmapColor = (count) => {
        if (count === 0) return 'bg-slate-100 text-slate-400';
        if (count <= 2) return 'bg-emerald-200 text-emerald-800';
        if (count <= 4) return 'bg-blue-300 text-blue-900';
        if (count <= 6) return 'bg-amber-400 text-amber-900';
        return 'bg-red-500 text-white';
    };

    const exportMasterPDF = async () => {
        try {
            // Get start time from first active timetable
            const activeTTs = timetables.filter(t => t.status === 'active' || t.status === 'generated');
            let startTime = "08:30";
            if (activeTTs.length > 0 && activeTTs[0].start_time) {
                startTime = activeTTs[0].start_time;
            }
            
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a3' // Changed to A3 for more space
            });

            let yPos = 20;

            // ===== COVER PAGE =====
            doc.setFontSize(28);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 64, 175); // Blue
            doc.text('QUEST University', 210, 50, { align: 'center' }); // Centered for A3
            
            doc.setFontSize(22);
            doc.setTextColor(139, 92, 246); // Violet
            doc.text('Master Timetable Report', 210, 65, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 116, 139); // Slate
            doc.text(`Academic Year: ${new Date().getFullYear()}`, 210, 80, { align: 'center' });
            doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`, 210, 88, { align: 'center' });
            doc.text(`Generated by: ${user?.full_name || user?.username}`, 210, 96, { align: 'center' });
            
            // Decorative line
            doc.setDrawColor(59, 130, 246);
            doc.setLineWidth(0.5);
            doc.line(80, 110, 340, 110);

            // ===== PAGE 2: EXECUTIVE SUMMARY =====
            doc.addPage();
            yPos = 20;
            
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('Executive Summary', 14, yPos);
            yPos += 15;

            // University Statistics Table
            const statsData = [
                ['Metric', 'Count', 'Details'],
                ['Total Departments', stats.totalDepartments || 0, 'Academic departments'],
                ['Faculty Members', stats.totalTeachers || 0, 'Teaching staff'],
                ['Lab Engineers', stats.totalLabEngineers || 0, 'Laboratory support'],
                ['Total Subjects', stats.totalSubjects || 0, 'Courses offered'],
                ['Available Rooms', stats.totalRooms || 0, 'Classrooms & labs'],
                ['Active Timetables', stats.activeTimetables || 0, 'Current schedules']
            ];

            autoTable(doc, {
                head: [statsData[0]],
                body: statsData.slice(1),
                startY: yPos,
                theme: 'striped',
                headStyles: { 
                    fillColor: [59, 130, 246],
                    fontSize: 11,
                    fontStyle: 'bold'
                },
                bodyStyles: { fontSize: 10 },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            yPos = doc.lastAutoTable.finalY + 15;

            // Department Breakdown
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Department Breakdown', 14, yPos);
            yPos += 10;

            const deptData = departments.map(dept => {
                const deptTeachers = teachers.filter(t => t.department_id === dept.id && !t.is_lab_engineer);
                const deptSubjects = subjects.filter(s => s.department_id === dept.id);
                const deptRooms = rooms.filter(r => r.department_id === dept.id);
                const deptTT = allTimetableData[dept.id];
                const totalClasses = deptTT ? deptTT.slots.filter(s => !s.is_break).length : 0;
                
                return [
                    dept.name,
                    dept.code,
                    deptTeachers.length,
                    deptSubjects.length,
                    deptRooms.length,
                    totalClasses
                ];
            });

            autoTable(doc, {
                head: [['Department', 'Code', 'Faculty', 'Subjects', 'Rooms', 'Classes']],
                body: deptData,
                startY: yPos,
                theme: 'grid',
                headStyles: { 
                    fillColor: [139, 92, 246],
                    fontSize: 10,
                    fontStyle: 'bold'
                },
                bodyStyles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 80 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 25, halign: 'center' },
                    3: { cellWidth: 30, halign: 'center' },
                    4: { cellWidth: 25, halign: 'center' },
                    5: { cellWidth: 25, halign: 'center' }
                }
            });

            // ===== PAGE 3: MASTER TIMETABLE =====
            if (heatmapGrid && heatmapGrid.length > 0) {
                doc.addPage();
                yPos = 20;

                doc.setFontSize(18);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text('Master Timetable', 14, yPos);
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text('Complete university schedule overview', 14, yPos + 6);
                yPos += 15;

                // Build heatmap table data with two-row header
                const heatmapTableData = [];
                const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                
                // First header row - Day names (Monday-Thursday: 8 cols, Friday: 6 cols)
                const headerRow1 = [
                    { content: 'Dept', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: 'Batch', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } }
                ];
                days.forEach((day, idx) => {
                    const colSpan = idx === 4 ? 6 : 8; // Friday has 6 slots
                    headerRow1.push({ content: day, colSpan: colSpan, styles: { halign: 'center' } });
                });

                // Second header row - Slot numbers (S1-S8 for Mon-Thu, S1-S6 for Fri)
                const headerRow2 = [];
                for (let d = 0; d < 5; d++) {
                    const slotsCount = d === 4 ? 6 : 8; // Friday has 6 slots
                    for (let s = 1; s <= slotsCount; s++) {
                        headerRow2.push(`S${s}`);
                    }
                }

                // Data rows for each batch
                heatmapGrid.forEach(batch => {
                    const row = [batch.deptCode, batch.batchYear];
                    
                    // For each day and slot
                    batch.slotData.forEach((day, dayIdx) => {
                        const slotsToShow = dayIdx === 4 ? 6 : 8; // Friday shows only 6 slots
                        day.slice(0, slotsToShow).forEach(classes => {
                            if (classes.length === 0) {
                                row.push('—');
                            } else {
                                // Group by section and show in lines
                                const sections = {};
                                classes.forEach(cls => {
                                    const sectionLetter = cls.section_name.slice(-1); // Get last character (A, B, C, etc.)
                                    if (!sections[sectionLetter]) {
                                        sections[sectionLetter] = [];
                                    }
                                    sections[sectionLetter].push(cls.subject_code);
                                });
                                
                                // Build multi-line cell content
                                const lines = [];
                                ['A', 'B', 'C', 'D', 'E'].forEach(letter => {
                                    if (sections[letter]) {
                                        lines.push(`${letter}: ${sections[letter].join(', ')}`);
                                    }
                                });
                                
                                // If no A/B/C/D/E sections, just show all subjects
                                if (lines.length === 0) {
                                    row.push(classes.map(c => c.subject_code).join(', '));
                                } else {
                                    row.push(lines.join('\n'));
                                }
                            }
                        });
                    });
                    
                    heatmapTableData.push(row);
                });

                autoTable(doc, {
                    head: [headerRow1, headerRow2],
                    body: heatmapTableData,
                    startY: yPos,
                    theme: 'grid',
                    headStyles: { 
                        fillColor: [71, 85, 105],
                        fontSize: 6,
                        fontStyle: 'bold',
                        halign: 'center',
                        valign: 'middle',
                        cellPadding: 1
                    },
                    bodyStyles: { 
                        fontSize: 5,
                        halign: 'center',
                        valign: 'middle',
                        cellPadding: 1,
                        minCellHeight: 10,
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { 
                            cellWidth: 15, 
                            fontStyle: 'bold', 
                            fillColor: [248, 250, 252],
                            fontSize: 6
                        },
                        1: { 
                            cellWidth: 12, 
                            fontStyle: 'bold', 
                            fillColor: [248, 250, 252],
                            fontSize: 6
                        }
                    },
                    didParseCell: function(data) {
                        // Color code cells based on content (skip Dept and Batch columns)
                        if (data.section === 'body' && data.column.index > 1) {
                            const cellText = data.cell.text.join('');
                            if (cellText === '—') {
                                data.cell.styles.fillColor = [248, 250, 252]; // Light gray for empty
                                data.cell.styles.textColor = [203, 213, 225];
                            } else {
                                // Count number of subjects (by counting commas + 1)
                                const subjectCount = cellText.split(',').length;
                                if (subjectCount >= 7) {
                                    data.cell.styles.fillColor = [254, 226, 226]; // Light red for very high
                                } else if (subjectCount >= 5) {
                                    data.cell.styles.fillColor = [254, 243, 199]; // Light amber for high
                                } else if (subjectCount >= 3) {
                                    data.cell.styles.fillColor = [219, 234, 254]; // Light blue for medium
                                } else {
                                    data.cell.styles.fillColor = [209, 250, 229]; // Light green for low
                                }
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                });

                // Legend
                yPos = doc.lastAutoTable.finalY + 6;
                doc.setFontSize(7);
                doc.setFont(undefined, 'bold');
                doc.text('Legend: A/B/C/D/E = Section letters • Subject codes shown per section • "—" = no classes • Color: Green (1-2), Blue (3-4), Amber (5-6), Red (7+) • Friday: Slots 1-6 only', 14, yPos);
            }

            // ===== DEPARTMENT TIMETABLES =====
            for (const dept of departments) {
                const deptTT = allTimetableData[dept.id];
                if (!deptTT || !deptTT.sections || deptTT.sections.length === 0) continue;

                doc.addPage();
                yPos = 20;

                // Department Header
                doc.setFontSize(16);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 41, 59);
                doc.text(`${dept.name} (${dept.code})`, 14, yPos);
                
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(`${deptTT.sections.length} sections • ${deptTT.slots.filter(s => !s.is_break).length} total classes`, 14, yPos + 6);
                yPos += 15;

                // For each section
                for (const section of deptTT.sections) {
                    const sectionSlots = deptTT.slots.filter(s => s.section_id === section.id);
                    
                    if (yPos > 180) {
                        doc.addPage();
                        yPos = 20;
                    }

                    // Section name
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(59, 130, 246);
                    doc.text(section.name, 14, yPos);
                    yPos += 8;

                    // Build timetable grid
                    const gridData = [];
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                    
                    for (let slot = 0; slot < 8; slot++) {
                        const row = [`Slot ${slot + 1}`];
                        
                        for (let day = 0; day < 5; day++) {
                            const slotData = sectionSlots.find(s => s.day === day && s.slot_index === slot);
                            
                            if (slotData) {
                                if (slotData.is_break) {
                                    row.push('BREAK');
                                } else {
                                    const instructor = slotData.is_lab ? slotData.lab_engineer_name : slotData.teacher_name;
                                    row.push(`${slotData.subject_code}\n${instructor || 'TBA'}\n${slotData.room_name || 'TBA'}${slotData.is_lab ? ' (Lab)' : ''}`);
                                }
                            } else {
                                row.push('—');
                            }
                        }
                        
                        gridData.push(row);
                    }

                    autoTable(doc, {
                        head: [['Time', ...days]],
                        body: gridData,
                        startY: yPos,
                        theme: 'grid',
                        headStyles: { 
                            fillColor: [71, 85, 105],
                            fontSize: 8,
                            fontStyle: 'bold',
                            halign: 'center'
                        },
                        bodyStyles: { 
                            fontSize: 7,
                            cellPadding: 2,
                            valign: 'middle',
                            halign: 'center'
                        },
                        columnStyles: {
                            0: { cellWidth: 20, fontStyle: 'bold', fillColor: [248, 250, 252] }
                        },
                        didParseCell: function(data) {
                            // Color code labs
                            if (data.section === 'body' && data.column.index > 0) {
                                const cellText = data.cell.text.join('');
                                if (cellText.includes('(Lab)')) {
                                    data.cell.styles.fillColor = [209, 250, 229]; // Green for labs
                                } else if (cellText === 'BREAK') {
                                    data.cell.styles.fillColor = [241, 245, 249]; // Gray for breaks
                                    data.cell.styles.fontStyle = 'italic';
                                } else if (cellText !== '—') {
                                    data.cell.styles.fillColor = [219, 234, 254]; // Blue for theory
                                }
                            }
                        }
                    });

                    yPos = doc.lastAutoTable.finalY + 10;
                }
            }

            // ===== FINAL PAGE: NOTES =====
            doc.addPage();
            yPos = 20;
            
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('Notes & Legend', 14, yPos);
            yPos += 15;

            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(71, 85, 105);
            
            const notes = [
                '• Blue cells indicate Theory classes',
                '• Green cells indicate Lab classes',
                '• Gray cells indicate Break periods',
                '• Heatmap shows subject codes for quick overview of entire university',
                '• "+X" in heatmap indicates multiple classes in same slot',
                '• Each detailed cell shows: Subject Code, Instructor Name, Room Number',
                '• Lab classes show Lab Engineer names',
                '• Theory classes show Teacher names',
                `• Time slots are 60 minutes each, starting from ${startTime}`,
                '• This report was generated automatically from the active timetables'
            ];

            notes.forEach(note => {
                doc.text(note, 14, yPos);
                yPos += 7;
            });

            // Footer on last page
            yPos = 270; // Adjusted for A3
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text('QUEST University - Timetable Management System', 210, yPos, { align: 'center' });
            doc.text(`Report generated on ${new Date().toLocaleDateString()}`, 210, yPos + 5, { align: 'center' });

            // Save PDF
            const filename = `QUEST_Master_Timetable_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(filename);
            
            // Success message
            alert(`✅ Master Timetable PDF exported successfully!\n\nFilename: ${filename}\n\nIncludes:\n• Executive Summary\n• Master Timetable (complete university schedule)\n• Department Statistics\n• Detailed Timetables for all departments\n• Color-coded schedules`);
            
        } catch (err) {
            console.error('PDF export failed:', err);
            alert('❌ Failed to generate PDF. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Loading Master Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white shadow-lg">
                            <HiOutlineChartBar className="w-7 h-7" />
                        </span>
                        VC Master Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">Comprehensive university-wide overview and analytics</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadLiveData}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                        <HiOutlineRefresh className="w-4 h-4" />
                        <span className="text-sm font-medium">Refresh</span>
                    </button>
                    <button
                        onClick={exportMasterPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:shadow-lg transition-all shadow-md">
                        <HiOutlineDownload className="w-4 h-4" />
                        <span className="text-sm font-medium">Export PDF</span>
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="glass rounded-xl p-1 flex gap-1">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all ${
                        activeTab === 'overview'
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    <HiOutlineViewGrid className="w-5 h-5" />
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('heatmap')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all ${
                        activeTab === 'heatmap'
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    <HiOutlineTable className="w-5 h-5" />
                    University Grid
                </button>
                <button
                    onClick={() => setActiveTab('timetables')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all ${
                        activeTab === 'timetables'
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    <HiOutlineCalendar className="w-5 h-5" />
                    Timetables
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all ${
                        activeTab === 'analytics'
                            ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    <HiOutlineTrendingUp className="w-5 h-5" />
                    Analytics
                </button>
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Live Classes - FIRST */}
                    <div className="glass p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                Classes Happening Now ({(() => {
                                    const filteredClasses = liveClassFilter === 'all' 
                                        ? liveClasses 
                                        : liveClasses.filter(c => c.department_id === parseInt(liveClassFilter));
                                    
                                    // Count unique batches instead of individual classes
                                    const uniqueBatches = new Set(
                                        filteredClasses.map(cls => {
                                            const batchKey = cls.section_name ? cls.section_name.split('-')[0] : 'Unknown';
                                            return `${cls.department_id}_${batchKey}`;
                                        })
                                    );
                                    return uniqueBatches.size;
                                })()} {(() => {
                                    const filteredClasses = liveClassFilter === 'all' 
                                        ? liveClasses 
                                        : liveClasses.filter(c => c.department_id === parseInt(liveClassFilter));
                                    const uniqueBatches = new Set(
                                        filteredClasses.map(cls => {
                                            const batchKey = cls.section_name ? cls.section_name.split('-')[0] : 'Unknown';
                                            return `${cls.department_id}_${batchKey}`;
                                        })
                                    );
                                    return uniqueBatches.size === 1 ? 'Batch' : 'Batches';
                                })()})
                            </h2>
                            <select
                                value={liveClassFilter}
                                onChange={(e) => setLiveClassFilter(e.target.value)}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.code} - {dept.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        {(() => {
                            const filteredClasses = liveClassFilter === 'all' 
                                ? liveClasses 
                                : liveClasses.filter(c => c.department_id === parseInt(liveClassFilter));
                            
                            // Group classes by batch (year + department) to avoid showing multiple sections
                            const groupedByBatch = {};
                            filteredClasses.forEach(cls => {
                                // Extract batch info from section name (e.g., "22CE-A" -> "22CE")
                                const batchKey = cls.section_name ? cls.section_name.split('-')[0] : 'Unknown';
                                const key = `${cls.department_id}_${batchKey}`;
                                
                                if (!groupedByBatch[key]) {
                                    groupedByBatch[key] = {
                                        batchName: batchKey,
                                        department_name: cls.department_name,
                                        department_id: cls.department_id,
                                        classes: []
                                    };
                                }
                                groupedByBatch[key].classes.push(cls);
                            });
                            
                            const batchGroups = Object.values(groupedByBatch);
                            
                            return batchGroups.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {batchGroups.map((group, idx) => {
                                        // Get unique subjects being taught to this batch
                                        const uniqueSubjects = [...new Set(group.classes.map(c => c.subject_code))];
                                        const sectionsCount = group.classes.length;
                                        
                                        return (
                                            <div key={idx} className="bg-white rounded-lg border-2 border-green-200 p-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-start justify-between mb-2">
                                                    <h3 className="font-bold text-slate-800">{group.batchName}</h3>
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                                                        {sectionsCount} {sectionsCount === 1 ? 'Section' : 'Sections'}
                                                    </span>
                                                </div>
                                                <div className="space-y-2 text-sm text-slate-600">
                                                    <p className="text-xs text-slate-500">{group.department_name}</p>
                                                    
                                                    {/* Show subjects being taught */}
                                                    <div className="mt-2">
                                                        <p className="text-xs font-medium text-slate-500 mb-1">Current Classes:</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {uniqueSubjects.map((subject, i) => (
                                                                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                                                                    {subject}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Show section details */}
                                                    <details className="mt-2">
                                                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                                                            View section details
                                                        </summary>
                                                        <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200">
                                                            {group.classes.map((cls, i) => (
                                                                <div key={i} className="text-xs">
                                                                    <span className="font-medium">{cls.section_name}:</span> {cls.subject_code}
                                                                    {cls.is_lab && <span className="text-emerald-600"> (Lab)</span>}
                                                                    <br />
                                                                    <span className="text-slate-500">
                                                                        {cls.is_lab ? cls.lab_engineer_name : cls.teacher_name} • {cls.room_name || 'TBA'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <HiOutlineClock className="w-16 h-16 mx-auto mb-3 opacity-50" />
                                    <p className="font-medium">
                                        {liveClassFilter === 'all' 
                                            ? 'No classes in progress at this time'
                                            : `No classes in progress for ${departments.find(d => d.id === parseInt(liveClassFilter))?.name || 'this department'}`
                                        }
                                    </p>
                                    <p className="text-sm mt-1">
                                        {todaySummary.isWeekend ? 'It\'s the weekend!' : `Classes run from ${todaySummary.startTime || '8:30 AM'} to 4:30 PM`}
                                    </p>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass p-6 rounded-xl border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <HiOutlineOfficeBuilding className="w-10 h-10 text-blue-600" />
                                <span className="text-4xl font-bold text-blue-600">{stats.totalDepartments}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Academic Departments</p>
                            <p className="text-xs text-slate-500 mt-1">Across university</p>
                        </div>

                        <div className="glass p-6 rounded-xl border-l-4 border-emerald-500 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <HiOutlineUserGroup className="w-10 h-10 text-emerald-600" />
                                <span className="text-4xl font-bold text-emerald-600">{stats.totalTeachers}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Faculty Members</p>
                            <p className="text-xs text-slate-500 mt-1">{stats.totalLabEngineers} lab engineers</p>
                        </div>

                        <div className="glass p-6 rounded-xl border-l-4 border-violet-500 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <HiOutlineAcademicCap className="w-10 h-10 text-violet-600" />
                                <span className="text-4xl font-bold text-violet-600">{stats.totalSubjects}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Total Subjects</p>
                            <p className="text-xs text-slate-500 mt-1">All programs</p>
                        </div>

                        <div className="glass p-6 rounded-xl border-l-4 border-amber-500 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-3">
                                <HiOutlineCalendar className="w-10 h-10 text-amber-600" />
                                <span className="text-4xl font-bold text-amber-600">{stats.activeTimetables}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Active Timetables</p>
                            <p className="text-xs text-slate-500 mt-1">Currently in use</p>
                        </div>
                    </div>

                    {/* Today's Summary */}
                    {!todaySummary.isWeekend && todaySummary.currentSlot !== null && (
                        <div className="glass p-6 rounded-xl border-l-4 border-green-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                        <HiOutlineClock className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Today's Progress</h3>
                                        <p className="text-sm text-slate-500">{todaySummary.dayName}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold text-green-600">{todaySummary.activeClasses}</div>
                                    <div className="text-xs text-slate-500">Classes Now</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">{todaySummary.completedSlots}</div>
                                    <div className="text-xs text-slate-600 mt-1">Completed Slots</div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">{todaySummary.currentSlot + 1}</div>
                                    <div className="text-xs text-slate-600 mt-1">Current Slot</div>
                                </div>
                                <div className="text-center p-3 bg-amber-50 rounded-lg">
                                    <div className="text-2xl font-bold text-amber-600">{todaySummary.remainingSlots}</div>
                                    <div className="text-xs text-slate-600 mt-1">Remaining Slots</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Department Cards Grid */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <HiOutlineOfficeBuilding className="w-6 h-6 text-blue-600" />
                            Departments Overview
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {departmentStats.map(dept => (
                                <div 
                                    key={dept.id}
                                    onClick={() => {
                                        setSelectedDepartment(dept.id);
                                        setActiveTab('timetables');
                                    }}
                                    className="glass p-5 rounded-xl hover:shadow-xl transition-all cursor-pointer border border-slate-200 hover:border-blue-300">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-800">{dept.code}</h3>
                                            <p className="text-sm text-slate-600">{dept.name}</p>
                                        </div>
                                        {dept.hasActiveTimetable ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                                                <HiOutlineCheckCircle className="w-3 h-3" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">
                                                No TT
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <div className="text-xl font-bold text-blue-600">{dept.teachers}</div>
                                            <div className="text-[10px] text-slate-600">Teachers</div>
                                        </div>
                                        <div className="p-2 bg-violet-50 rounded-lg">
                                            <div className="text-xl font-bold text-violet-600">{dept.subjects}</div>
                                            <div className="text-[10px] text-slate-600">Subjects</div>
                                        </div>
                                        <div className="p-2 bg-amber-50 rounded-lg">
                                            <div className="text-xl font-bold text-amber-600">{dept.rooms}</div>
                                            <div className="text-[10px] text-slate-600">Rooms</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-center">
                                        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                            View Timetable →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* HEATMAP TAB */}
            {activeTab === 'heatmap' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="glass p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Master Timetable</h2>
                                <p className="text-sm text-slate-500 mt-1">Complete university schedule overview</p>
                            </div>
                        </div>
                        
                        {heatmapGrid.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th rowSpan={2} className="sticky left-0 bg-slate-50 border border-slate-300 p-3 text-center font-bold text-slate-700 min-w-[80px] z-10">
                                                    Dept
                                                </th>
                                                <th rowSpan={2} className="sticky left-[80px] bg-slate-50 border border-slate-300 p-3 text-center font-bold text-slate-700 min-w-[60px] z-10">
                                                    Batch
                                                </th>
                                                {Array(5).fill(null).map((_, dayIdx) => {
                                                    const slotsCount = dayIdx === 4 ? 6 : 8;
                                                    return (
                                                        <th key={dayIdx} colSpan={slotsCount} className="border border-slate-300 p-2 text-center font-bold text-slate-700 bg-slate-50">
                                                            {getDayName(dayIdx)}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                {Array(5).fill(null).map((_, dayIdx) => {
                                                    const slotsCount = dayIdx === 4 ? 6 : 8;
                                                    return Array(slotsCount).fill(null).map((_, slotIdx) => (
                                                        <th key={`${dayIdx}-${slotIdx}`} className="border border-slate-300 p-1 text-[10px] text-slate-500 bg-slate-50 min-w-[80px]">
                                                            S{slotIdx + 1}
                                                        </th>
                                                    ));
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {heatmapGrid.map((batch) => (
                                                <tr key={`${batch.deptId}-${batch.batchYear}`} className="hover:bg-slate-50">
                                                    <td className="sticky left-0 bg-white border border-slate-300 p-3 font-bold text-slate-800 z-10 text-center">
                                                        {batch.deptCode}
                                                    </td>
                                                    <td className="sticky left-[80px] bg-white border border-slate-300 p-3 font-bold text-slate-700 z-10 text-center">
                                                        {batch.batchYear}
                                                    </td>
                                                    {batch.slotData.map((day, dayIdx) => {
                                                        const slotsToShow = dayIdx === 4 ? 6 : 8;
                                                        return day.slice(0, slotsToShow).map((classes, slotIdx) => {
                                                            const count = classes.length;
                                                            // Group classes by section for display
                                                            const classesBySection = {};
                                                            classes.forEach(cls => {
                                                                const sectionLetter = cls.section_name.split('-').pop();
                                                                if (!classesBySection[sectionLetter]) {
                                                                    classesBySection[sectionLetter] = [];
                                                                }
                                                                classesBySection[sectionLetter].push(cls);
                                                            });
                                                            
                                                            return (
                                                                <td 
                                                                    key={`${dayIdx}-${slotIdx}`}
                                                                    className={`border border-slate-300 p-1.5 text-[9px] leading-tight transition-colors cursor-pointer hover:shadow-lg min-w-[80px] ${
                                                                        count === 0 ? 'bg-slate-50' :
                                                                        'bg-blue-50'
                                                                    }`}
                                                                    title={`Batch ${batch.batchYear} - ${getDayName(dayIdx)} Slot ${slotIdx + 1}\n${classes.map(c => `${c.section_name}: ${c.subject_code}${c.is_lab ? ' (Lab)' : ''}`).join('\n')}`}>
                                                                    {count > 0 ? (
                                                                        <div className="space-y-0.5">
                                                                            {Object.entries(classesBySection).map(([section, sectionClasses]) => (
                                                                                <div key={section} className="flex items-center gap-1">
                                                                                    <span className="font-bold text-[8px] text-slate-500 min-w-[12px]">{section}:</span>
                                                                                    <div className="flex-1 flex flex-wrap gap-0.5">
                                                                                        {sectionClasses.map((cls, idx) => (
                                                                                            <span 
                                                                                                key={idx}
                                                                                                className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                                                                                                    cls.is_lab 
                                                                                                        ? 'bg-emerald-600 text-white' 
                                                                                                        : 'bg-blue-600 text-white'
                                                                                                }`}>
                                                                                                {cls.subject_code}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-slate-300 text-center">—</div>
                                                                    )}
                                                                </td>
                                                            );
                                                        });
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Legend */}
                                <div className="mt-6 flex items-center gap-6 justify-center flex-wrap p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-base font-bold text-slate-700">Visual Guide:</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-slate-50 border-2 border-slate-300 rounded flex items-center justify-center text-slate-300 text-base">—</div>
                                        <span className="text-sm text-slate-600 font-medium">Free Slot</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-2 bg-emerald-50 border-2 border-emerald-200 rounded">
                                            <div className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded">LAB</div>
                                        </div>
                                        <span className="text-sm text-slate-600 font-medium">Lab Class</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-2 bg-blue-50 border-2 border-blue-200 rounded">
                                            <div className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded">RPC</div>
                                        </div>
                                        <span className="text-sm text-slate-600 font-medium">Theory Class</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 italic">Note: Each row shows one batch with all sections (A, B, C, etc.). Friday shows slots 1-6 only.</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                <HiOutlineCalendar className="w-16 h-16 mx-auto mb-3 opacity-50" />
                                <p className="font-medium">No timetable data available</p>
                                <p className="text-sm mt-1">Generate timetables to see the heatmap</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TIMETABLES TAB */}
            {activeTab === 'timetables' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Department Selector */}
                    <div className="glass p-5 rounded-xl">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Select Department to View Timetable</label>
                        <select
                            value={selectedDepartment || ''}
                            onChange={(e) => setSelectedDepartment(Number(e.target.value))}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700 font-medium">
                            <option value="">-- Select a Department --</option>
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} ({dept.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Timetable Display */}
                    {selectedDepartment && allTimetableData[selectedDepartment] ? (
                        <div className="glass p-6 rounded-xl">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">
                                        {departments.find(d => d.id === selectedDepartment)?.name} Timetable
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {allTimetableData[selectedDepartment].sections.length} sections • {allTimetableData[selectedDepartment].slots.filter(s => !s.is_break).length} total classes
                                    </p>
                                </div>
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                    <HiOutlineDownload className="w-4 h-4" />
                                    Print
                                </button>
                            </div>
                            
                            {allTimetableData[selectedDepartment].sections.map(section => {
                                const sectionSlots = allTimetableData[selectedDepartment].slots.filter(
                                    s => s.section_id === section.id
                                );
                                const ttStartTime = allTimetableData[selectedDepartment].start_time || "08:30";

                                return (
                                    <div key={section.id} className="mb-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <h3 className="text-xl font-bold text-slate-700 px-4 py-2 bg-gradient-to-r from-blue-100 to-violet-100 rounded-lg">
                                                {section.name}
                                            </h3>
                                            <span className="text-sm text-slate-500">
                                                ({sectionSlots.filter(s => !s.is_break).length} classes per week)
                                            </span>
                                        </div>
                                        
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className="border-2 border-slate-300 p-3 bg-slate-100 text-xs font-bold text-slate-600 w-24">
                                                            Time
                                                        </th>
                                                        {Array(5).fill(null).map((_, dayIdx) => (
                                                            <th key={dayIdx} className="border-2 border-slate-300 p-3 bg-slate-100 text-sm font-bold text-slate-700">
                                                                {getDayName(dayIdx)}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Array(8).fill(null).map((_, slotIdx) => (
                                                        <tr key={slotIdx}>
                                                            <td className="border-2 border-slate-300 p-2 bg-slate-50 text-xs font-medium text-slate-600 text-center">
                                                                <div className="font-bold">Slot {slotIdx + 1}</div>
                                                                <div className="text-[10px] mt-1">{getSlotTime(slotIdx, ttStartTime)}</div>
                                                            </td>
                                                            {Array(5).fill(null).map((_, dayIdx) => {
                                                                const slot = sectionSlots.find(
                                                                    s => s.day === dayIdx && s.slot_index === slotIdx
                                                                );

                                                                return (
                                                                    <td key={dayIdx} className="border-2 border-slate-300 p-2">
                                                                        {slot ? (
                                                                            slot.is_break ? (
                                                                                <div className="text-center py-3 bg-slate-100 rounded text-xs font-bold text-slate-500">
                                                                                    BREAK
                                                                                </div>
                                                                            ) : (
                                                                                <div className={`p-3 rounded-lg text-xs ${
                                                                                    slot.is_lab 
                                                                                        ? 'bg-emerald-50 border-2 border-emerald-300' 
                                                                                        : 'bg-blue-50 border-2 border-blue-300'
                                                                                }`}>
                                                                                    <div className="font-bold text-slate-800 mb-1">{slot.subject_code}</div>
                                                                                    <div className="text-slate-600">
                                                                                        {slot.is_lab ? slot.lab_engineer_name : slot.teacher_name}
                                                                                    </div>
                                                                                    <div className="text-slate-500 mt-1">
                                                                                        📍 {slot.room_name || 'TBA'}
                                                                                    </div>
                                                                                    {slot.is_lab && (
                                                                                        <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">
                                                                                            LAB
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            <div className="h-20 bg-slate-50 rounded"></div>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : selectedDepartment ? (
                        <div className="glass p-12 rounded-xl text-center text-slate-500">
                            <HiOutlineCalendar className="w-20 h-20 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">No timetable found for this department</p>
                            <p className="text-sm mt-2">Generate a timetable to view it here</p>
                        </div>
                    ) : null}
                </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass p-6 rounded-xl border-l-4 border-blue-500">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                    <HiOutlineCheckCircle className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-blue-600">
                                        {Math.round((stats.activeTimetables / stats.totalDepartments) * 100)}%
                                    </div>
                                    <div className="text-sm text-slate-600">Timetable Coverage</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                {stats.activeTimetables} of {stats.totalDepartments} departments have active timetables
                            </p>
                        </div>

                        <div className="glass p-6 rounded-xl border-l-4 border-emerald-500">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <HiOutlineUserGroup className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-emerald-600">
                                        {stats.totalDepartments > 0 ? Math.round(stats.totalTeachers / stats.totalDepartments) : 0}
                                    </div>
                                    <div className="text-sm text-slate-600">Avg Teachers/Dept</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Average faculty members per department
                            </p>
                        </div>

                        <div className="glass p-6 rounded-xl border-l-4 border-violet-500">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                                    <HiOutlineAcademicCap className="w-6 h-6 text-violet-600" />
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-violet-600">
                                        {stats.totalDepartments > 0 ? Math.round(stats.totalSubjects / stats.totalDepartments) : 0}
                                    </div>
                                    <div className="text-sm text-slate-600">Avg Subjects/Dept</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Average subjects offered per department
                            </p>
                        </div>
                    </div>

                    {/* Department Comparison */}
                    <div className="glass p-6 rounded-xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">Department Comparison</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Department</th>
                                        <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Teachers</th>
                                        <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Subjects</th>
                                        <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Rooms</th>
                                        <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departmentStats.map((dept, idx) => (
                                        <tr key={dept.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                            <td className="py-3 px-4">
                                                <div>
                                                    <div className="font-bold text-slate-800">{dept.code}</div>
                                                    <div className="text-xs text-slate-500">{dept.name}</div>
                                                </div>
                                            </td>
                                            <td className="text-center py-3 px-4">
                                                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                                                    {dept.teachers}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-4">
                                                <span className="inline-block px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-bold">
                                                    {dept.subjects}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-4">
                                                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                                                    {dept.rooms}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-4">
                                                {dept.hasActiveTimetable ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                                        <HiOutlineCheckCircle className="w-4 h-4" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">
                                                        <HiOutlineExclamation className="w-4 h-4" />
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass p-6 rounded-xl">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Resource Distribution</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-600">Faculty Members</span>
                                        <span className="text-sm font-bold text-slate-800">{stats.totalTeachers}</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: '100%' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-600">Lab Engineers</span>
                                        <span className="text-sm font-bold text-slate-800">{stats.totalLabEngineers}</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600" style={{ width: `${(stats.totalLabEngineers / stats.totalTeachers) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-600">Total Rooms</span>
                                        <span className="text-sm font-bold text-slate-800">{stats.totalRooms}</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-600" style={{ width: '100%' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass p-6 rounded-xl">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Insights</h3>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                                    <HiOutlineCheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">
                                            {stats.activeTimetables} departments have active timetables
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {stats.totalDepartments - stats.activeTimetables} pending generation
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                                    <HiOutlineUserGroup className="w-5 h-5 text-emerald-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">
                                            {stats.totalTeachers + stats.totalLabEngineers} total teaching staff
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Across all departments
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg">
                                    <HiOutlineAcademicCap className="w-5 h-5 text-violet-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">
                                            {stats.totalSubjects} subjects offered university-wide
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Comprehensive curriculum
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
