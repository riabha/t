import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { HiOutlineAcademicCap, HiOutlineBeaker } from 'react-icons/hi';

export default function MyAssignmentsPage() {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMyAssignments();
    }, []);

    const loadMyAssignments = async () => {
        try {
            setLoading(true);
            
            // Check if user has a teacher profile
            if (!user?.teacher_id) {
                console.log('User does not have a teacher profile');
                setAssignments([]);
                return;
            }

            // Get assignments using the teacher_id from user profile
            const assignmentsRes = await api.get('/assignments/', {
                params: { teacher_id: user.teacher_id }
            });
            const allAssignments = assignmentsRes.data.filter(a => a.session_id !== null);
            setAssignments(allAssignments);

        } catch (error) {
            console.error('Error loading assignments:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Loading your assignments...</div>
            </div>
        );
    }

    if (!user?.teacher_id) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
                <div className="text-5xl mb-4">👤</div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Teacher Profile</h3>
                <p className="text-sm text-slate-500">
                    Your account is not linked to a teacher profile. Contact your administrator to set up your teaching profile.
                </p>
            </div>
        );
    }

    // Group assignments by session and department
    const groupedAssignments = {};
    assignments.forEach(a => {
        const sessionId = a.session_id;
        const deptName = a.department_name || 'Unknown Department';
        const sessionName = a.session_name || 'Unknown Session';
        
        const key = `${sessionId}-${deptName}`;
        if (!groupedAssignments[key]) {
            groupedAssignments[key] = {
                sessionId,
                sessionName,
                departmentName: deptName,
                assignments: []
            };
        }
        groupedAssignments[key].assignments.push(a);
    });

    // Calculate total workload
    let totalTheoryLoad = 0;
    let totalLabLoad = 0;
    let totalHours = 0;

    assignments.forEach(a => {
        const numSections = a.section_names?.length || 0;
        if (a.teacher_id === user.teacher_id) {
            const theoryCredits = (a.theory_credits || 0) * numSections;
            totalTheoryLoad += theoryCredits;
            totalHours += theoryCredits;
        }
        if (a.lab_engineer_id === user.teacher_id) {
            const labCredits = (a.lab_credits || 0) * numSections;
            totalLabLoad += labCredits;
            totalHours += labCredits * 3;
        }
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Subject Assignments</h1>
                    <p className="text-slate-500 mt-1">Complete overview of your teaching assignments across all departments</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-medium text-slate-600">Total Workload</p>
                        <p className="text-lg font-bold text-primary-600">
                            {totalTheoryLoad.toFixed(1)} Th • {totalLabLoad.toFixed(1)} Lab
                        </p>
                        <p className="text-xs text-slate-400">{totalHours.toFixed(1)} contact hours</p>
                    </div>
                </div>
            </div>

            {assignments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                    <HiOutlineAcademicCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No assignments found</p>
                    <p className="text-sm text-slate-400 mt-1">Contact your department admin to assign subjects</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Assignments by Session & Department */}
                    {Object.values(groupedAssignments)
                        .sort((a, b) => b.sessionId - a.sessionId)
                        .map(group => {
                            const theoryAssignments = group.assignments.filter(a => a.teacher_id === user.teacher_id);
                            const labAssignments = group.assignments.filter(a => a.lab_engineer_id === user.teacher_id);
                            
                            const groupTheoryLoad = theoryAssignments.reduce((sum, a) => 
                                sum + (a.theory_credits || 0) * (a.section_names?.length || 0), 0);
                            const groupLabLoad = labAssignments.reduce((sum, a) => 
                                sum + (a.lab_credits || 0) * (a.section_names?.length || 0), 0);
                            const groupHours = groupTheoryLoad + (groupLabLoad * 3);

                            return (
                                <div key={`${group.sessionId}-${group.departmentName}`} 
                                     className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-gradient-to-r from-primary-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-800">{group.departmentName}</h3>
                                                <p className="text-sm text-slate-500">{group.sessionName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-primary-600">
                                                    {groupTheoryLoad.toFixed(1)} Th • {groupLabLoad.toFixed(1)} Lab
                                                </p>
                                                <p className="text-xs text-slate-400">{groupHours.toFixed(1)} hrs</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Theory Subjects */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-indigo-600 mb-3 flex items-center gap-2">
                                                    <HiOutlineAcademicCap className="w-5 h-5" />
                                                    Theory Subjects ({theoryAssignments.length})
                                                </h4>
                                                {theoryAssignments.length === 0 ? (
                                                    <p className="text-sm text-slate-400 italic">None assigned</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {theoryAssignments.map(a => (
                                                            <div key={`th-${a.id}`} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                                                                                {a.subject_code}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                                                                                {a.theory_credits} credits
                                                                            </span>
                                                                        </div>
                                                                        <h5 className="font-medium text-slate-800 mb-1">{a.subject_full_name}</h5>
                                                                        <p className="text-sm text-slate-600">
                                                                            <span className="font-medium">{a.batch_name}</span>
                                                                            {a.section_names?.length > 0 && (
                                                                                <span className="ml-2">
                                                                                    • Sections: {a.section_names.join(', ')}
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between text-xs text-slate-500">
                                                                    <span>{a.section_names?.length || 0} sections</span>
                                                                    <span>{((a.theory_credits || 0) * (a.section_names?.length || 0)).toFixed(1)} total credits</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Lab Subjects */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-emerald-600 mb-3 flex items-center gap-2">
                                                    <HiOutlineBeaker className="w-5 h-5" />
                                                    Lab Subjects ({labAssignments.length})
                                                </h4>
                                                {labAssignments.length === 0 ? (
                                                    <p className="text-sm text-slate-400 italic">None assigned</p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {labAssignments.map(a => (
                                                            <div key={`lab-${a.id}`} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                                                                                {a.subject_code}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                                                                                {a.lab_credits} credits
                                                                            </span>
                                                                        </div>
                                                                        <h5 className="font-medium text-slate-800 mb-1">{a.subject_full_name}</h5>
                                                                        <p className="text-sm text-slate-600">
                                                                            <span className="font-medium">{a.batch_name}</span>
                                                                            {a.section_names?.length > 0 && (
                                                                                <span className="ml-2">
                                                                                    • Sections: {a.section_names.join(', ')}
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between text-xs text-slate-500">
                                                                    <span>{a.section_names?.length || 0} sections</span>
                                                                    <span>{((a.lab_credits || 0) * (a.section_names?.length || 0)).toFixed(1)} total credits</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}