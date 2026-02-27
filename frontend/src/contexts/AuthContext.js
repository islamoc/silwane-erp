import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Parse and validate a JWT token without external libraries.
 * Returns the payload or null if invalid/expired.
 */
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null; // expired
    }
    return payload;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('erp_token');
    const savedUser = localStorage.getItem('erp_user');

    if (token && savedUser) {
      const payload = parseJwt(token);
      if (payload) {
        // Token still valid - restore session
        setUser(JSON.parse(savedUser));
      } else {
        // Token expired - clear storage
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_user');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Login function
   * Sends { email, password } to POST /api/auth/login
   * API responds with { success, data: { user, token } }
   */
  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { data } = response;

      // Handle both response shapes:
      // { success, data: { user, token } }  <- standard
      // { success, user, token }            <- flat (legacy)
      const token = data?.data?.token || data?.token;
      const userData = data?.data?.user || data?.user;

      if (!token || !userData) {
        return {
          success: false,
          error: 'Login response is missing token or user data. Please contact support.'
        };
      }

      // Persist token and user
      localStorage.setItem('erp_token', token);
      localStorage.setItem('erp_user', JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Login failed. Check your credentials and try again.';
      return { success: false, error: message };
    }
  }, []);

  /**
   * Logout function
   * Clears all stored auth data
   */
  const logout = useCallback(() => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    // Also clear legacy keys if they exist
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  /**
   * Check if current user has at least the given role level
   */
  const hasPermission = useCallback((requiredRole) => {
    if (!user) return false;

    const roleHierarchy = {
      super_admin: 7,
      admin: 6,
      manager: 5,
      accountant: 4,
      sales: 3,
      warehouse: 2,
      viewer: 1,
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
  }, [user]);

  /**
   * Check if user has a specific permission key
   */
  const hasSpecificPermission = useCallback((permissionKey) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.permissions?.all) return true;
    return !!(user.permissions?.[permissionKey]);
  }, [user]);

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    hasSpecificPermission,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
