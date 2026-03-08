import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(false);

    const login = async (username, password) => {
        const res = await api.post('/auth/login', { username, password });
        const { access_token, role, full_name, user_id, department_id, teacher_id,
            can_manage_restrictions, can_delete_timetable } = res.data;
        localStorage.setItem('token', access_token);
        const userData = {
            role, full_name, username, id: user_id,
            department_id, teacher_id,
            can_manage_restrictions: can_manage_restrictions || false,
            can_delete_timetable: can_delete_timetable || false,
        };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const isAdmin = user?.role === 'super_admin' || user?.role === 'program_admin';
    const isSuperAdmin = user?.role === 'super_admin';
    const isClerk = user?.role === 'clerk';
    const canManageRestrictions = isSuperAdmin || (user?.can_manage_restrictions === true);
    const canDeleteTimetable = isSuperAdmin || (user?.can_delete_timetable === true);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isSuperAdmin, isClerk, canManageRestrictions, canDeleteTimetable }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
export { AuthContext };
