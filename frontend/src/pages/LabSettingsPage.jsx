import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineBeaker, HiOutlineSave, HiOutlineFilter,
    HiOutlineCheckCircle, HiOutlineClock, HiOutlineInformationCircle
} from 'react-icons/hi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function LabSettingsPage() {
    const { user } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [batches, setBatches] = useState([]);
    const [sections, setSections] = useState([]);
    
    const [selectedDept, setSelectedDept] = useState(user?.department_id || '');
    const [selectedBatch, setSelectedBatch] = useState('');
    
    // Batch configs
    const [batchConfigs, setBatchConfigs] = useState({});
    const [editingBatch, setEditingBatch] = useState(null);
    const [savingBatch, setSavingBatch] = useState(null);
    
    // Section configs
    const [sectionConfigs, setSectionConfigs] = useState({});
    const [editingSection, setEditingSection] = useState(null);
    const [savingSection, setSavingSection] = useState(null);

    useEffect(() => {
        loadDepartments();
    }, []);

    useEffect(() => {
        if (selectedDept) {
            loadBatches();
        }
    }, [selectedDept]);

    useEffect(() => {
        if (selectedBatch) {
            loadSections();
        }
    }, [selectedBatch]);

    const loadDepartments = async () => {
        const res = await api.get('/departments/');
        setDepartments(res.data);
        if (!selectedDept && res.data.length > 0) {
            if (user?.role === 'super_admin') {
                setSelectedDept(res.data[0].id);
            } else if (user?.department_id) {
                setSelectedDept(user.department_id);
            }
        }
    };

    const loadBatches = async () => {
        const res = await api.get('/departments/batches');
        const filtered = res.data.filter(b => b.department_id === parseInt(selectedDept));
        setBatches(filtered);
        loadBatchConfigs(filtered);
    };

    const loadBatchConfigs = async (batchList) => {
        const configs = {};
        for (const batch of batchList) {
            // Batch config is already in the batch object from /departments/batches
            configs[batch.id] = {
                morning_lab_mode: batch.morning_lab_mode || null,
                morning_lab_count: batch.morning_lab_count || null,
                morning_lab_days: batch.morning_lab_days || []
            };
        }
        setBatchConfigs(configs);
    };

    const updateBatchConfig = (batchId, field, value) => {
        setBatchConfigs(prev => ({
            ...prev,
            [batchId]: { ...prev[batchId], [field]: value }
        }));
    };

    const toggleBatchDay = (batchId, dayIdx) => {
        const config = batchConfigs[batchId] || {};
        const days = [...(config.morning_lab_days || [])];
        if (days.includes(dayIdx)) {
            updateBatchConfig(batchId, 'morning_lab_days', days.filter(d => d !== dayIdx));
        } else {
            updateBatchConfig(batchId, 'morning_lab_days', [...days, dayIdx]);
        }
    };

    const saveBatchConfig = async (batchId) => {
        setSavingBatch(batchId);
        try {
            // Find the batch to get its current data
            const batch = batches.find(b => b.id === batchId);
            if (!batch) {
                throw new Error('Batch not found');
            }
            
            // Update batch with new morning lab config
            const updateData = {
                year: batch.year,
                department_id: batch.department_id,
                semester: batch.semester,
                morning_lab_mode: batchConfigs[batchId].morning_lab_mode || null,
                morning_lab_count: batchConfigs[batchId].morning_lab_count || null,
                morning_lab_days: batchConfigs[batchId].morning_lab_days || []
            };
            
            console.log('Saving batch config:', updateData);
            
            const response = await api.put(`/departments/batches/${batchId}`, updateData);
            console.log('Save response:', response.data);
            
            alert('Batch configuration saved successfully');
            setEditingBatch(null);
            // Reload batches to get updated data
            loadBatches();
        } catch (err) {
            console.error('Failed to save - Full error:', err);
            console.error('Error response:', err.response);
            const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
            alert('Failed to save: ' + errorMsg);
        } finally {
            setSavingBatch(null);
        }
    };

    const loadSections = async () => {
        const res = await api.get('/departments/sections');
        const filtered = res.data.filter(s => s.batch_id === parseInt(selectedBatch));
        setSections(filtered);
        loadSectionConfigs(filtered);
    };

    const loadSectionConfigs = async (sectionList) => {
        const configs = {};
        for (const section of sectionList) {
            try {
                const res = await api.get(`/restrictions/config/${section.id}`);
                configs[section.id] = res.data;
            } catch (err) {
                configs[section.id] = { lab_morning_days: [], no_gaps: true };
            }
        }
        setSectionConfigs(configs);
    };

    const updateSectionConfig = (sectionId, field, value) => {
        setSectionConfigs(prev => ({
            ...prev,
            [sectionId]: { ...prev[sectionId], [field]: value }
        }));
    };

    const toggleSectionDay = (sectionId, dayIdx) => {
        const config = sectionConfigs[sectionId] || {};
        const days = [...(config.lab_morning_days || [])];
        if (days.includes(dayIdx)) {
            updateSectionConfig(sectionId, 'lab_morning_days', days.filter(d => d !== dayIdx));
        } else {
            updateSectionConfig(sectionId, 'lab_morning_days', [...days, dayIdx]);
        }
    };

    const saveSectionConfig = async (sectionId) => {
        setSavingSection(sectionId);
        try {
            await api.put(`/restrictions/config/${sectionId}`, sectionConfigs[sectionId]);
            alert('Section configuration saved successfully');
            setEditingSection(null);
        } catch (err) {
            console.error('Failed to save', err);
            alert('Failed to save: ' + (err.response?.data?.detail || err.message));
        } finally {
            setSavingSection(null);
        }
    };

    const getModeColor = (mode) => {
        switch (mode) {
            case 'strict': return 'bg-green-100 text-green-700 border-green-200';
            case 'prefer': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'count': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-slate-100 text-slate-500 border-slate-200';
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Lab Settings</h1>
                    <p className="text-sm text-slate-500">Configure lab scheduling preferences globally, by batch, or by section</p>
                </div>

                {user?.role === 'super_admin' && (
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                        <HiOutlineFilter className="text-slate-400" />
                        <select
                            value={selectedDept}
                            onChange={e => setSelectedDept(e.target.value)}
                            className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                        >
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Batch-Level Settings */}
            <div className="glass p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <HiOutlineBeaker className="w-6 h-6 text-indigo-600" />
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Batch-Level Lab Configuration</h2>
                        <p className="text-xs text-slate-500">Configure morning lab requirements for entire batches</p>
                    </div>
                </div>

                {batches.length > 0 ? (
                    <div className="space-y-4">
                        {batches.map(batch => {
                            const config = batchConfigs[batch.id] || {};
                            const isEditing = editingBatch === batch.id;
                            const isSaving = savingBatch === batch.id;

                            return (
                                <div key={batch.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-800">{batch.display_name}</h3>
                                            {/* Current Configuration Summary */}
                                            <p className="text-xs text-slate-500 mt-1">
                                                {config.morning_lab_mode === 'strict' && (
                                                    <span className="text-green-600 font-medium">
                                                        🌅 All labs in morning • Days: {config.morning_lab_days?.length > 0 ? config.morning_lab_days.map(d => DAYS[d].substring(0,3)).join(', ') : 'All days'}
                                                    </span>
                                                )}
                                                {config.morning_lab_mode === 'prefer' && (
                                                    <span className="text-blue-600 font-medium">
                                                        ☀️ Prefer morning labs • Days: {config.morning_lab_days?.length > 0 ? config.morning_lab_days.map(d => DAYS[d].substring(0,3)).join(', ') : 'All days'}
                                                    </span>
                                                )}
                                                {config.morning_lab_mode === 'count' && (
                                                    <span className="text-purple-600 font-medium">
                                                        📊 {config.morning_lab_count || 0} labs in morning • Days: {config.morning_lab_days?.length > 0 ? config.morning_lab_days.map(d => DAYS[d].substring(0,3)).join(', ') : 'All days'}
                                                    </span>
                                                )}
                                                {!config.morning_lab_mode && (
                                                    <span className="text-slate-400">
                                                        🌆 Afternoon only (default)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setEditingBatch(isEditing ? null : batch.id)}
                                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                            {isEditing ? 'Cancel' : 'Configure'}
                                        </button>
                                    </div>

                                    {isEditing && (
                                        <div className="space-y-4 pt-3 border-t border-slate-100">
                                            {/* Lab Placement Strategy */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-700">Lab Placement Strategy</label>
                                                <select
                                                    value={config.morning_lab_mode || ''}
                                                    onChange={e => updateBatchConfig(batch.id, 'morning_lab_mode', e.target.value || null)}
                                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                                >
                                                    <option value="">Afternoon Only (Default - No morning labs)</option>
                                                    <option value="prefer">Prefer Morning Labs</option>
                                                    <option value="strict">All Labs in Morning (Strict)</option>
                                                    <option value="count">Specific Number of Morning Labs</option>
                                                </select>
                                                <p className="text-[10px] text-slate-500 ml-1 italic">
                                                    {!config.morning_lab_mode && 'Labs will only be placed in afternoon slots (after break)'}
                                                    {config.morning_lab_mode === 'prefer' && 'Solver will try to place labs in morning first'}
                                                    {config.morning_lab_mode === 'strict' && 'All labs MUST be in morning slots'}
                                                    {config.morning_lab_mode === 'count' && 'Specify exact number of labs to place in morning'}
                                                </p>
                                            </div>

                                            {/* Days Selection - for all modes */}
                                            {config.morning_lab_mode && (
                                                <div className="space-y-2 animate-in slide-in-from-top duration-200">
                                                    <label className="text-xs font-bold text-slate-700">Apply to These Days (leave empty for all days)</label>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {DAYS.map((day, idx) => (
                                                            <button
                                                                key={day}
                                                                onClick={() => toggleBatchDay(batch.id, idx)}
                                                                className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                                                                    config.morning_lab_days?.includes(idx)
                                                                        ? 'bg-primary-50 border-primary-200 text-primary-700'
                                                                        : 'bg-white border-slate-200 text-slate-500'
                                                                }`}
                                                            >
                                                                {day.substring(0, 3)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 ml-1 italic">
                                                        Select specific days for morning labs. Leave empty to apply to all days.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Lab Count for count mode */}
                                            {config.morning_lab_mode === 'count' && (
                                                <div className="space-y-2 animate-in slide-in-from-top duration-200">
                                                    <label className="text-xs font-bold text-slate-700">Number of Morning Labs</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={config.morning_lab_count || ''}
                                                        onChange={e => updateBatchConfig(batch.id, 'morning_lab_count', parseInt(e.target.value) || null)}
                                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                                        placeholder="e.g., 2"
                                                    />
                                                    <p className="text-[10px] text-slate-500 ml-1 italic">
                                                        Specify exactly how many labs should be in morning slots.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => saveBatchConfig(batch.id)}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                                                >
                                                    <HiOutlineSave className="w-4 h-4" />
                                                    {isSaving ? 'Saving...' : 'Save Configuration'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm">Select a department to view batches</p>
                    </div>
                )}
            </div>

            {/* Section-Level Settings */}
            {selectedBatch && (
                <div className="glass p-6 space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                        <HiOutlineCheckCircle className="w-6 h-6 text-amber-600" />
                        <div>
                            <h2 className="font-bold text-slate-800 text-lg">Section-Level Lab Configuration</h2>
                            <p className="text-xs text-slate-500">Override batch settings for specific sections</p>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                        <label className="text-xs font-bold text-slate-700">Select Batch</label>
                        <select
                            value={selectedBatch}
                            onChange={e => setSelectedBatch(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        >
                            <option value="">Choose a batch...</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                        </select>
                    </div>

                    {sections.length > 0 ? (
                        <div className="space-y-4">
                            {sections.map(section => {
                                const config = sectionConfigs[section.id] || {};
                                const isEditing = editingSection === section.id;
                                const isSaving = savingSection === section.id;

                                return (
                                    <div key={section.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-slate-800">{section.name}</h3>
                                            <button
                                                onClick={() => setEditingSection(isEditing ? null : section.id)}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                {isEditing ? 'Cancel' : 'Configure'}
                                            </button>
                                        </div>

                                        {isEditing && (
                                            <div className="space-y-4 pt-3 border-t border-slate-100">
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                    <div className="flex items-start gap-2">
                                                        <HiOutlineInformationCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                        <div className="text-xs text-amber-800">
                                                            <p className="font-bold mb-1">Deprecated Feature</p>
                                                            <p>Section-level morning lab configuration is deprecated. Use batch-level settings instead.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 opacity-50 pointer-events-none">
                                                    <label className="text-xs font-bold text-slate-700">Morning Lab Days (Deprecated)</label>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {DAYS.map((day, idx) => (
                                                            <button
                                                                key={day}
                                                                disabled
                                                                className={`px-3 py-2 rounded-xl border text-xs font-medium ${
                                                                    config.lab_morning_days?.includes(idx)
                                                                        ? 'bg-primary-50 border-primary-200 text-primary-700'
                                                                        : 'bg-white border-slate-200 text-slate-500'
                                                                }`}
                                                            >
                                                                {day.substring(0, 3)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-sm">No sections found for this batch</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
