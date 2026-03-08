import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import TimetableGrid from '../components/TimetableGrid';
import { HiOutlineLockClosed, HiOutlineExclamationCircle } from 'react-icons/hi';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ical from 'ical-generator';

export default function MySchedulePage() {
    const { user } = useAuth();
    const [timetables, setTimetables] = useState([]); // Full list of timetables where teacher has classes
    const [activeTT, setActiveTT] = useState(null);
    const [mySlots, setMySlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [passwordChanging, setPasswordChanging] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState(null);

    console.log('MySchedulePage loaded - NEW VERSION with cross-department support');
    console.log('User:', user?.full_name);

    const loadAllSchedules = async (timetablesToLoad, updateTimetablesList = true) => {
        try {
            console.log('Loading schedules for user:', user?.full_name);
            console.log('Timetables to load:', timetablesToLoad.length);
            let allSlots = [];
            const timetablesWithSlots = []; // Track which timetables have slots

            // Load slots from ALL timetables using the teacher-specific endpoint
            for (const tt of timetablesToLoad) {
                console.log(`Loading timetable ${tt.id}: ${tt.name}`);
                try {
                    // Use the my-schedule endpoint which automatically filters by current user's teacher_id
                    const res = await api.get(`/timetable/${tt.id}/my-schedule`);
                    let slots = res.data.slots || [];
                    console.log(`  Raw slots from ${tt.name}: ${slots.length}`);

                    // CRITICAL FIX: Filter out incorrect lab slots
                    // Only show lab slots where user is actually the lab engineer
                    // Only show theory slots where user is actually the teacher
                    // DO NOT include break slots in teacher's personal schedule
                    slots = slots.filter(slot => {
                        // Skip break slots in teacher view
                        if (slot.is_break) {
                            return false;
                        }
                        
                        if (slot.is_lab) {
                            // For lab slots, user must be the lab engineer
                            return slot.lab_engineer_id === user.teacher_id;
                        } else {
                            // For theory slots, user must be the teacher
                            return slot.teacher_id === user.teacher_id;
                        }
                    });
                    
                    console.log(`  Filtered slots for user in ${tt.name}: ${slots.length}`);

                    // Only include timetable if teacher has teaching slots in it
                    if (slots.length > 0) {
                        timetablesWithSlots.push(tt);
                        
                        // Add department info to each slot for display
                        slots.forEach(slot => {
                            slot.timetable_name = tt.name;
                            slot.department_id = tt.department_id;
                        });

                        allSlots = allSlots.concat(slots);
                    }
                } catch (e) {
                    // If user has no teacher profile or no slots in this timetable, skip
                    console.log(`  No schedule found in timetable ${tt.name}:`, e.response?.status);
                }
            }

            console.log('Total filtered slots across all timetables:', allSlots.length);
            console.log('Timetables with slots:', timetablesWithSlots.length);
            
            // Only update timetables list on initial load, not when switching views
            if (updateTimetablesList) {
                setTimetables(timetablesWithSlots);
            }
            setMySlots(allSlots);
        } catch (e) {
            console.error('Error loading schedules:', e);
        }
    };

    const loadSchedule = async (ttId) => {
        setActiveTT(ttId);
        setLoading(true);
        try {
            // Reload assignments for workload calculation
            await loadAssignmentsForWorkload();
            
            // If a specific timetable is selected, show only that one
            // Pass updateTimetablesList=false to preserve the full timetables list
            const ttToLoad = timetables.find(tt => tt.id === ttId);
            if (ttToLoad) {
                await loadAllSchedules([ttToLoad], false);
            }
        } catch (e) { 
            console.error('Error loading specific timetable:', e); 
        }
        setLoading(false);
    };

    useEffect(() => {
        async function load() {
            try {
                // Check if user has teacher profile
                if (!user?.teacher_id) {
                    console.log('User does not have a teacher profile');
                    setLoading(false);
                    return;
                }

                const ttRes = await api.get('/timetable/list');
                // Filter to only show latest (non-archived) timetables
                const latestTimetables = ttRes.data.filter(tt => tt.status !== 'archived');
                setTimetables(latestTimetables);

                // Load assignments for workload calculation
                await loadAssignmentsForWorkload();

                // Load schedule from ALL latest timetables to show cross-department engagements
                if (latestTimetables.length > 0) {
                    setActiveTT(null); // Set to null for "All Departments" mode
                    await loadAllSchedules(latestTimetables);
                }
            } catch (e) { 
                console.error('Error loading timetables:', e); 
            }
            setLoading(false);
        }
        if (user) {
            load();
        }
    }, [user]);

    // Compute workload from assignments data, not timetable slots
    const [assignments, setAssignments] = useState([]);
    
    const loadAssignmentsForWorkload = async () => {
        try {
            if (!user?.teacher_id) return;
            
            // Get assignments for workload calculation
            const assignmentsRes = await api.get('/assignments/', {
                params: { teacher_id: user.teacher_id }
            });
            const allAssignments = assignmentsRes.data.filter(a => a.session_id !== null);
            setAssignments(allAssignments);
        } catch (e) {
            console.error('Error loading assignments for workload:', e);
        }
    };

    // Calculate workload from assignments (not timetable slots)
    let theoryHours = 0;
    let labHours = 0;
    
    assignments.forEach(a => {
        const numSections = a.section_names?.length || 0;
        if (a.teacher_id === user?.teacher_id) {
            // Theory teaching
            theoryHours += (a.theory_credits || 0) * numSections;
        }
        if (a.lab_engineer_id === user?.teacher_id) {
            // Lab engineering (multiply by 3 for contact hours)
            labHours += (a.lab_credits || 0) * numSections * 3;
        }
    });

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (passwordForm.new_password.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setPasswordChanging(true);
        try {
            await api.post('/users/change-password', {
                old_password: passwordForm.old_password,
                new_password: passwordForm.new_password
            });
            setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
            setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
            setTimeout(() => {
                setPasswordMessage(null);
                setShowPasswordForm(false);
            }, 2000);
        } catch (e) {
            setPasswordMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to change password' });
        } finally {
            setPasswordChanging(false);
        }
    };

    const exportToPDF = () => {
        try {
            console.log('Starting PDF export...');
            console.log('User:', user?.full_name);
            console.log('Slots:', mySlots.length);

            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

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

            const activeTimetable = timetables.find(tt => tt.id === activeTT);
            if (activeTimetable) {
                doc.setFontSize(10);
                doc.text(activeTimetable.name, 35, 26);
            }

            // Section name with classroom
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            const sectionName = `${user?.full_name || 'Teacher'}'s Schedule`;
            doc.text(sectionName, 14, 36);

            // Get start time from timetable (default to 08:30 if not set)
            const startTime = activeTimetable?.start_time || timetables[0]?.start_time || "08:30";
            const [startHour, startMinute] = startTime.split(':').map(Number);

            // Calculate time slots
            const calculateTimeSlot = (slotIndex) => {
                let currentTime = new Date();
                currentTime.setHours(startHour, startMinute, 0);
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

            // Prepare data for table
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const maxSlots = 8;

            // Create time slot headers
            const timeHeaders = ['Day'];
            for (let s = 0; s < maxSlots; s++) {
                if (s === 2) { // Break slot
                    timeHeaders.push('10:30-11:00\nBreak');
                } else {
                    timeHeaders.push(calculateTimeSlot(s));
                }
            }

            // Create table data - only subject codes
            const tableData = [];
            const subjectDetails = {}; // For legend

            for (let d = 0; d < 5; d++) {
                const row = [days[d]];
                for (let s = 0; s < maxSlots; s++) {
                    const slot = mySlots.find(sl => sl.day === d && sl.slot_index === s);
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

            console.log('Table data prepared:', tableData.length, 'rows');

            // Add table using autoTable
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

            console.log('Table added to PDF');

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

            // Add summary below legend table
            const summaryY = doc.lastAutoTable.finalY + 5;
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text(`Theory Hours: ${theoryHours}  |  Lab Hours: ${labHours}  |  Total Contact Hours: ${theoryHours + labHours}`, 14, summaryY);

            // Add approval note at bottom (smaller font)
            const approvalY = summaryY + 10;
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            const deptFullName = user?.department_name || 'Concerned Department';
            doc.text(`The time table is approved by Chairman ${deptFullName}`, 14, approvalY);

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

            // Save the PDF
            const fileName = `${user?.full_name?.replace(/\s+/g, '_') || 'Teacher'}_Schedule.pdf`;
            console.log('Saving PDF as:', fileName);
            doc.save(fileName);

            console.log('PDF generated successfully!');
        } catch (error) {
            console.error('PDF generation error:', error);
            console.error('Error details:', error.message, error.stack);
            alert(`Failed to generate PDF: ${error.message}`);
        }
    };

    const exportToCSV = () => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const maxSlots = 8;

        // CSV Header
        let csv = 'Day,Slot 1,Slot 2,Slot 3,Slot 4,Slot 5,Slot 6,Slot 7,Slot 8\n';

        // CSV Data
        for (let d = 0; d < 5; d++) {
            csv += days[d];
            for (let s = 0; s < maxSlots; s++) {
                const slot = mySlots.find(sl => sl.day === d && sl.slot_index === s);
                if (slot && !slot.is_break) {
                    const text = `"${slot.section_name || ''} ${slot.subject_code}${slot.is_lab ? ' (Lab)' : ''} ${slot.room_name || ''}"`;
                    csv += ',' + text;
                } else if (slot && slot.is_break) {
                    csv += ',Break';
                } else {
                    csv += ',-';
                }
            }
            csv += '\n';
        }

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${user?.full_name}_Schedule.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const exportToICal = () => {
        const calendar = ical({ name: `${user?.full_name}'s Schedule` });

        // Get start time from timetable
        const icalActiveTimetable = timetables.find(tt => tt.id === activeTT);
        const icalStartTime = icalActiveTimetable?.start_time || timetables[0]?.start_time || "08:30";
        const [icalStartHour, icalStartMinute] = icalStartTime.split(':').map(Number);

        // Get current week's Monday
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        mySlots.forEach(slot => {
            if (slot.is_break || !slot.subject_code) return;

            // Calculate date for this slot
            const eventDate = new Date(monday);
            eventDate.setDate(monday.getDate() + slot.day);

            // Calculate time using configurable start time
            const totalMinutes = icalStartMinute + (slot.slot_index * 60);
            const actualStartHour = icalStartHour + Math.floor(totalMinutes / 60);
            const actualStartMinute = totalMinutes % 60;

            const start = new Date(eventDate);
            start.setHours(actualStartHour, actualStartMinute, 0);

            const end = new Date(start);
            end.setMinutes(end.getMinutes() + (slot.is_lab ? 180 : 60)); // 3 hours for lab, 1 for theory

            calendar.createEvent({
                start: start,
                end: end,
                summary: `${slot.subject_code}${slot.is_lab ? ' (Lab)' : ''} - ${slot.section_name || ''}`,
                description: `Teacher: ${user?.full_name}\nRoom: ${slot.room_name || 'TBA'}`,
                location: slot.room_name || '',
                repeating: {
                    freq: 'WEEKLY',
                    count: 16 // Repeat for 16 weeks (semester)
                }
            });
        });

        // Download
        const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${user?.full_name}_Schedule.ics`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">My Schedule</h1>
                    <p className="text-sm text-slate-500">{user?.full_name} • Cross-Department View</p>
                </div>
                <div className="flex gap-2">
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
                    <button
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-colors">
                        <HiOutlineLockClosed className="w-4 h-4" />
                        Change Password
                    </button>
                </div>
            </div>

            {/* Password Change Form */}
            {showPasswordForm && (
                <div className="glass p-5">
                    <h2 className="text-sm font-bold text-slate-800 mb-4">Change Your Password</h2>

                    {passwordMessage && (
                        <div className={`p-3 rounded-xl flex items-center gap-2 mb-4 ${passwordMessage.type === 'success'
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border border-rose-200 text-rose-700'
                            }`}>
                            <HiOutlineExclamationCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">{passwordMessage.text}</span>
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.old_password}
                                    onChange={e => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.new_password}
                                    onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 ml-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordForm.confirm_password}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary-400"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordForm(false);
                                    setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
                                    setPasswordMessage(null);
                                }}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={passwordChanging}
                                className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-colors disabled:opacity-50">
                                {passwordChanging ? 'Changing...' : 'Change Password'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Workload Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{theoryHours}</p>
                    <p className="text-xs text-slate-500">Theory Hours</p>
                </div>
                <div className="glass p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{labHours}</p>
                    <p className="text-xs text-slate-500">Lab Hours</p>
                </div>
                <div className="glass p-4 text-center">
                    <p className="text-2xl font-bold text-violet-600">{theoryHours + labHours}</p>
                    <p className="text-xs text-slate-500">Total Contact</p>
                </div>
            </div>

            {/* Version selector */}
            {timetables.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-slate-500 self-center mr-1">View:</span>
                    <button
                        onClick={async () => {
                            setActiveTT(null);
                            setLoading(true);
                            await loadAssignmentsForWorkload();
                            // Load all timetables, don't update the list (already set)
                            await loadAllSchedules(timetables, false);
                            setLoading(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTT === null
                            ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                            : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                            }`}>
                        All Departments
                    </button>
                    {/* Group timetables by department and show only departments where teacher has classes */}
                    {(() => {
                        // Get unique departments from timetables where teacher has slots
                        const deptMap = new Map();
                        timetables.forEach(tt => {
                            if (tt.department_id && !deptMap.has(tt.department_id)) {
                                // Get department name from timetable name or use department_id
                                let deptName = 'Department ' + tt.department_id;
                                if (tt.department_id === 1) deptName = 'Civil Engineering';
                                else if (tt.department_id === 2) deptName = 'Civil Engineering Technology';
                                else if (tt.department_id === 3) deptName = 'Building & Architectural Engineering';
                                else if (tt.department_id === 7) deptName = 'Electrical Engineering';
                                else if (tt.department_id === 9) deptName = 'Chemical Engineering';
                                
                                deptMap.set(tt.department_id, { name: deptName, timetable: tt });
                            }
                        });
                        
                        return Array.from(deptMap.values()).map(({ name, timetable }) => (
                            <button 
                                key={timetable.department_id} 
                                onClick={() => loadSchedule(timetable.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTT === timetable.id
                                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                                    : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                                    }`}>
                                {name}
                            </button>
                        ));
                    })()}
                </div>
            )}

            {/* Schedule Grid */}
            {loading ? (
                <div className="glass p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Loading your schedule...</p>
                </div>
            ) : !user?.teacher_id ? (
                <div className="glass p-12 text-center">
                    <div className="text-5xl mb-4">👤</div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No Teacher Profile</h3>
                    <p className="text-sm text-slate-500">
                        Your account is not linked to a teacher profile. Contact your administrator to set up your teaching profile.
                    </p>
                </div>
            ) : mySlots.length > 0 ? (
                <TimetableGrid sectionName={`${user?.full_name}'s Schedule`} slots={mySlots} isTeacherView={true} />
            ) : assignments.length > 0 ? (
                // Show assignment-based schedule when timetable slots are missing
                <div className="space-y-4">
                    <div className="glass p-6">
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3">📋</div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Schedule Based on Assignments</h3>
                            <p className="text-sm text-slate-500">
                                Your teaching schedule based on subject assignments. Timetable generation is pending.
                            </p>
                        </div>
                        
                        {/* Group assignments by department */}
                        {(() => {
                            const groupedAssignments = {};
                            assignments.forEach(a => {
                                const deptName = a.department_name || 'Unknown Department';
                                if (!groupedAssignments[deptName]) {
                                    groupedAssignments[deptName] = { theory: [], lab: [] };
                                }
                                
                                if (a.teacher_id === user?.teacher_id) {
                                    groupedAssignments[deptName].theory.push(a);
                                }
                                if (a.lab_engineer_id === user?.teacher_id) {
                                    groupedAssignments[deptName].lab.push(a);
                                }
                            });
                            
                            return Object.entries(groupedAssignments).map(([deptName, deptAssignments]) => (
                                <div key={deptName} className="mb-6 last:mb-0">
                                    <h4 className="text-md font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-primary-500"></div>
                                        {deptName}
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Theory Assignments */}
                                        <div>
                                            <h5 className="text-sm font-medium text-indigo-600 mb-2">Theory Subjects</h5>
                                            {deptAssignments.theory.length === 0 ? (
                                                <p className="text-sm text-slate-400 italic">None assigned</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {deptAssignments.theory.map(a => (
                                                        <div key={`th-${a.id}`} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-indigo-800">{a.subject_code}</span>
                                                                <span className="text-xs text-indigo-600">{a.theory_credits} cr</span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 mb-1">{a.subject_full_name}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {a.batch_name} • {a.section_names?.join(', ') || 'No sections'}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Lab Assignments */}
                                        <div>
                                            <h5 className="text-sm font-medium text-emerald-600 mb-2">Lab Subjects</h5>
                                            {deptAssignments.lab.length === 0 ? (
                                                <p className="text-sm text-slate-400 italic">None assigned</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {deptAssignments.lab.map(a => (
                                                        <div key={`lab-${a.id}`} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-emerald-800">{a.subject_code}</span>
                                                                <span className="text-xs text-emerald-600">{a.lab_credits} cr</span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 mb-1">{a.subject_full_name}</p>
                                                            <p className="text-xs text-slate-500">
                                                                {a.batch_name} • {a.section_names?.join(', ') || 'No sections'}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            ) : (
                <div className="glass p-12 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No Schedule Found</h3>
                    <p className="text-sm text-slate-500">
                        You might not have any assignments linked to a generated timetable yet.
                    </p>
                </div>
            )}
        </div>
    );
}