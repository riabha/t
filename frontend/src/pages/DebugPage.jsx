import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function DebugPage() {
    const { user } = useAuth();
    const [debugInfo, setDebugInfo] = useState({});
    const [loading, setLoading] = useState(false);

    const runDebugTests = async () => {
        setLoading(true);
        const results = {
            userSession: user,
            localStorage: {
                token: localStorage.getItem('token') ? 'Present' : 'Missing',
                user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : 'Missing'
            },
            apiTests: {}
        };

        if (!user?.teacher_id) {
            results.apiTests.error = 'No teacher_id in session - please logout and login again';
            setDebugInfo(results);
            setLoading(false);
            return;
        }

        try {
            // Test assignments API
            const assignmentsRes = await api.get('/assignments/', {
                params: { teacher_id: user.teacher_id }
            });
            results.apiTests.assignments = {
                status: 'Success',
                count: assignmentsRes.data.length,
                theory: assignmentsRes.data.filter(a => a.teacher_id === user.teacher_id).length,
                lab: assignmentsRes.data.filter(a => a.lab_engineer_id === user.teacher_id).length
            };
        } catch (e) {
            results.apiTests.assignments = {
                status: 'Failed',
                error: e.response?.data?.detail || e.message
            };
        }

        try {
            // Test timetables API
            const timetablesRes = await api.get('/timetable/list');
            const activeTimetables = timetablesRes.data.filter(tt => tt.status !== 'archived');
            results.apiTests.timetables = {
                status: 'Success',
                total: timetablesRes.data.length,
                active: activeTimetables.length,
                list: activeTimetables.map(tt => ({ id: tt.id, name: tt.name, dept: tt.department_id }))
            };

            // Test schedule APIs
            let totalSlots = 0;
            const scheduleResults = [];
            for (const tt of activeTimetables) {
                try {
                    const scheduleRes = await api.get(`/timetable/${tt.id}/my-schedule`);
                    const slots = scheduleRes.data.slots || [];
                    totalSlots += slots.length;
                    if (slots.length > 0) {
                        scheduleResults.push({ ttId: tt.id, ttName: tt.name, slots: slots.length });
                    }
                } catch (e) {
                    scheduleResults.push({ ttId: tt.id, ttName: tt.name, error: e.message });
                }
            }
            results.apiTests.schedule = {
                status: 'Success',
                totalSlots,
                byTimetable: scheduleResults
            };

        } catch (e) {
            results.apiTests.timetables = {
                status: 'Failed',
                error: e.response?.data?.detail || e.message
            };
        }

        setDebugInfo(results);
        setLoading(false);
    };

    useEffect(() => {
        if (user) {
            runDebugTests();
        }
    }, [user]);

    if (!user) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">Not logged in. Please login first.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Debug Information</h1>
                <button
                    onClick={runDebugTests}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Testing...' : 'Refresh Tests'}
                </button>
            </div>

            {/* User Session Info */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">User Session</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">Username:</span> {user.username}
                    </div>
                    <div>
                        <span className="font-medium">Full Name:</span> {user.full_name}
                    </div>
                    <div>
                        <span className="font-medium">Role:</span> {user.role}
                    </div>
                    <div>
                        <span className="font-medium">Department ID:</span> {user.department_id}
                    </div>
                    <div className={user.teacher_id ? 'text-green-600' : 'text-red-600'}>
                        <span className="font-medium">Teacher ID:</span> {user.teacher_id || 'MISSING - LOGOUT/LOGIN REQUIRED'}
                    </div>
                </div>
            </div>

            {/* LocalStorage Info */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Browser Storage</h2>
                <div className="space-y-2 text-sm">
                    <div>
                        <span className="font-medium">Token:</span> {debugInfo.localStorage?.token}
                    </div>
                    <div>
                        <span className="font-medium">User Data:</span>
                        <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-auto">
                            {JSON.stringify(debugInfo.localStorage?.user, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>

            {/* API Test Results */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">API Test Results</h2>
                
                {debugInfo.apiTests?.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <p className="text-red-700 font-medium">{debugInfo.apiTests.error}</p>
                        <p className="text-red-600 text-sm mt-2">
                            Please logout and login again to fix this issue.
                        </p>
                    </div>
                )}

                {/* Assignments Test */}
                {debugInfo.apiTests?.assignments && (
                    <div className="mb-4">
                        <h3 className="font-medium mb-2">Assignments API</h3>
                        <div className={`p-3 rounded-lg ${debugInfo.apiTests.assignments.status === 'Success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            {debugInfo.apiTests.assignments.status === 'Success' ? (
                                <div className="text-green-700">
                                    <p>✅ Success: {debugInfo.apiTests.assignments.count} total assignments</p>
                                    <p className="text-sm">Theory: {debugInfo.apiTests.assignments.theory}, Lab: {debugInfo.apiTests.assignments.lab}</p>
                                </div>
                            ) : (
                                <p className="text-red-700">❌ Failed: {debugInfo.apiTests.assignments.error}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Timetables Test */}
                {debugInfo.apiTests?.timetables && (
                    <div className="mb-4">
                        <h3 className="font-medium mb-2">Timetables API</h3>
                        <div className={`p-3 rounded-lg ${debugInfo.apiTests.timetables.status === 'Success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            {debugInfo.apiTests.timetables.status === 'Success' ? (
                                <div className="text-green-700">
                                    <p>✅ Success: {debugInfo.apiTests.timetables.active} active timetables</p>
                                    <div className="text-sm mt-2">
                                        {debugInfo.apiTests.timetables.list.map(tt => (
                                            <div key={tt.id}>TT {tt.id}: {tt.name} (Dept: {tt.dept})</div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-red-700">❌ Failed: {debugInfo.apiTests.timetables.error}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Schedule Test */}
                {debugInfo.apiTests?.schedule && (
                    <div className="mb-4">
                        <h3 className="font-medium mb-2">Schedule API</h3>
                        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                            <div className="text-green-700">
                                <p>✅ Success: {debugInfo.apiTests.schedule.totalSlots} total schedule slots</p>
                                <div className="text-sm mt-2">
                                    {debugInfo.apiTests.schedule.byTimetable.map(result => (
                                        <div key={result.ttId}>
                                            TT {result.ttId} ({result.ttName}): {result.slots || 0} slots
                                            {result.error && <span className="text-red-600"> - Error: {result.error}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Expected Results */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Expected Results by User</h2>
                <div className="text-sm space-y-1">
                    <div><strong>Jawad:</strong> 6 assignments, 4 timetables, 9 slots</div>
                    <div><strong>Muneeb:</strong> 4 assignments, 4 timetables, 14 slots</div>
                    <div><strong>Aamir:</strong> 5 assignments, 4 timetables, 23 slots</div>
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Troubleshooting</h2>
                <div className="text-sm space-y-2">
                    <p><strong>If teacher_id is missing:</strong> Logout and login again</p>
                    <p><strong>If API calls fail:</strong> Check browser console (F12) for errors</p>
                    <p><strong>If data doesn't match expected:</strong> Contact system administrator</p>
                    <p><strong>If page doesn't load:</strong> Clear browser cache (Ctrl+Shift+Delete)</p>
                </div>
            </div>
        </div>
    );
}