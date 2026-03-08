import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiOutlineAcademicCap, HiOutlineLightningBolt, HiOutlineShieldCheck, HiOutlineCalendar } from 'react-icons/hi';

const DEMO_CREDENTIALS = [
    { u: 'admin', p: 'admin123', label: 'Super Admin', badge: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
    { u: 'admin_ce', p: 'admin123', label: 'CE Admin', badge: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
    { u: 'admin_cet', p: 'admin123', label: 'CET Admin', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
    { u: 'admin_bae', p: 'admin123', label: 'BAE Admin', badge: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
    { u: 'riaz', p: 'teacher123', label: 'Teacher', badge: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100' },
];

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (u, p) => { setUsername(u); setPassword(p); };

    return (
        <div className="min-h-screen flex">
            {/* ═══════════ LEFT — Colorful Hero Panel ═══════════ */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden flex-col justify-between p-12 bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50">
                {/* Colorful background blobs */}
                <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-blue-200/50 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3" />
                <div className="absolute top-1/3 right-0 w-[350px] h-[350px] bg-violet-200/40 rounded-full blur-3xl translate-x-1/4" />
                <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-amber-200/30 rounded-full blur-3xl translate-y-1/4" />
                <div className="absolute bottom-20 right-10 w-[200px] h-[200px] bg-emerald-200/30 rounded-full blur-3xl" />

                {/* Floating colored shapes */}
                <div className="absolute top-20 right-20 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 rotate-12 opacity-30 animate-float" />
                <div className="absolute top-1/2 left-10 w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 opacity-25 animate-float-slow" />
                <div className="absolute bottom-32 right-1/3 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 -rotate-12 opacity-25 animate-float-delay" />

                {/* Top branding */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-20">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <HiOutlineAcademicCap className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 text-xl">QUEST</h1>
                            <p className="text-[10px] text-amber-600 uppercase tracking-[0.2em] font-bold">Timetable Portal</p>
                        </div>
                    </div>

                    <h2 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.15] mb-6">
                        <span className="text-slate-800">Intelligent</span><br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600">Schedule Management</span>
                    </h2>
                    <p className="text-slate-500 text-lg max-w-md leading-relaxed">
                        Manage timetables, assign faculty workloads, and ensure conflict-free scheduling across all departments.
                    </p>
                </div>

                {/* Feature pills */}
                <div className="relative z-10 flex flex-wrap gap-3">
                    {[
                        { icon: HiOutlineLightningBolt, text: 'Auto-Generate', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                        { icon: HiOutlineShieldCheck, text: 'Conflict-Free', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                        { icon: HiOutlineCalendar, text: 'Multi-Session', color: 'text-violet-600 bg-violet-50 border-violet-200' },
                    ].map(({ icon: Icon, text, color }) => (
                        <div key={text} className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${color}`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-bold">{text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══════════ RIGHT — Login Form ═══════════ */}
            <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center bg-white p-6 sm:p-10 relative">
                <div className="relative w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/20">
                            <HiOutlineAcademicCap className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-xl font-display font-bold text-slate-800">QUEST Timetable Portal</h1>
                        <p className="text-xs text-slate-500 mt-1">Admin Login</p>
                    </div>

                    {/* Card */}
                    <div className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 p-8">
                        <div className="mb-6">
                            <h2 className="text-2xl font-display font-bold text-slate-800">Welcome back</h2>
                            <p className="text-sm text-slate-500 mt-1">Sign in to access the admin dashboard</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                                <input
                                    id="login-username"
                                    type="text" value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                                               text-slate-800 placeholder-slate-400 text-sm
                                               focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                                               transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                                <input
                                    id="login-password"
                                    type="password" value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                                               text-slate-800 placeholder-slate-400 text-sm
                                               focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                                               transition-all"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    {error}
                                </div>
                            )}

                            <button
                                id="login-submit"
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-bold text-sm
                                           hover:from-blue-700 hover:to-violet-700 transition-all disabled:opacity-50
                                           shadow-lg shadow-blue-500/25 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Signing in...
                                    </span>
                                ) : 'Sign In'}
                            </button>
                        </form>

                        {/* Demo Credentials */}
                        <div className="mt-6 pt-5 border-t border-slate-100">
                            <p className="text-xs text-slate-400 text-center mb-3 font-medium">Quick Access — Demo Accounts</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {DEMO_CREDENTIALS.map(({ u, p, label, badge }) => (
                                    <button key={u} onClick={() => fillDemo(u, p)}
                                        className={`text-xs py-2.5 px-3 rounded-xl transition-all border font-semibold hover:scale-[1.02] active:scale-95 ${badge}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Back link */}
                    <div className="text-center mt-5 flex items-center justify-center gap-4">
                        <Link to="/" className="text-xs text-slate-400 hover:text-blue-600 transition-colors font-medium">
                            ← Public Timetable
                        </Link>
                        <span className="text-slate-300">•</span>
                        <Link to="/about" className="text-xs text-slate-400 hover:text-blue-600 transition-colors font-medium">
                            About & Guide
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
