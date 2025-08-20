'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bike, TreePine, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Admin Authentication System
 * 
 * This component handles admin login with role-based access control.
 * It validates credentials against the admin database and redirects
 * users based on their role permissions.
 * 
 * Roles:
 * - Super Admin: Full access to all features and data
 * - Admin: Access to most features with some restrictions
 * - Manager: Limited access to specific sections
 * - Editor: Read-only access with content editing permissions
 */

/**
 * Admin Credentials Loader
 * 
 * Loads admin credentials from localStorage (admin-managed data).
 * In production, this would be replaced with secure API authentication.
 */
// REMOVED: getAdminCredentials and all hardcoded credentials

export default function AdminPage() {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  /**
   * Authentication Handler
   *
   * This will be updated to call a secure backend API for authentication.
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginAttempts >= 5) {
      toast.error('Too many failed attempts. Please try again later.');
      return;
    }
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      toast.error('Please enter both username and password');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' }));
        setLoginAttempts(prev => prev + 1);
        toast.error(err.error || 'Invalid credentials');
        return;
      }
      toast.success('Logged in successfully');
      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 500);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Role Permissions System
   * 
   * Defines what each role can access and modify.
   * This system ensures proper access control throughout the admin panel.
   */
  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'Super Admin':
        return {
          canManageAdmins: true,
          canManageAllData: true,
          canDeleteData: true,
          canExportData: true,
          canViewAnalytics: true,
          canManageSettings: true
        };
      case 'Admin':
        return {
          canManageAdmins: false,
          canManageAllData: true,
          canDeleteData: true,
          canExportData: true,
          canViewAnalytics: true,
          canManageSettings: false
        };
      case 'Manager':
        return {
          canManageAdmins: false,
          canManageAllData: false,
          canDeleteData: false,
          canExportData: true,
          canViewAnalytics: true,
          canManageSettings: false
        };
      case 'Editor':
        return {
          canManageAdmins: false,
          canManageAllData: false,
          canDeleteData: false,
          canExportData: false,
          canViewAnalytics: false,
          canManageSettings: false
        };
      default:
        return {
          canManageAdmins: false,
          canManageAllData: false,
          canDeleteData: false,
          canExportData: false,
          canViewAnalytics: false,
          canManageSettings: false
        };
    }
  };
  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    toast.success('You have been logged out Successfully. ');
    setTimeout(() =>{
      window.location.href = '/admin';
    },30000);
  }; 

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      {/* Logout Button
      {typeof window !== 'undefined' && localStorage.getItem('adminSession') && (
        <div className="absolute top-4 right-4">
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      )} */}
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-8">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="relative">
              <Shield className="h-12 w-12 text-primary" />
              {/* <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Bike className="h-2 w-2 text-white" />
              </div> */}
            </div>
            {/* <TreePine className="h-10 w-10 text-green-600" /> */}
          </div>
          <CardTitle className="text-3xl bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Admin Login
          </CardTitle>
          <p className="text-muted-foreground">
            Secure access to Save Earth Ride admin panel
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                placeholder="Enter your username"
                className="bg-background"
                disabled={isLoading}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                placeholder="Enter your password"
                className="bg-background"
                
                required
              />
            </div>
            
            {/* Security Warning */}
            {loginAttempts > 2 && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">
                  {5 - loginAttempts} attempts remaining before lockout
                </span>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Login to Admin Panel
                </>
              )}
            </Button>
            
            {/* Demo Credentials Info */}
            {/* <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                Demo Credentials:
              </h4>
              <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <div><strong>Super Admin:</strong> admin / saveearthride2024</div>
                <div><strong>Manager:</strong> manager / manager123</div>
              </div>
            </div> */}
            
            {/* Role Information */}
            {/* <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                Role Permissions:
              </h4>
              <div className="space-y-1 text-xs text-green-700 dark:text-green-300">
                <div><strong>Super Admin:</strong> Full access to all features</div>
                <div><strong>Admin:</strong> Manage data, limited admin access</div>
                <div><strong>Manager:</strong> View and export data only</div>
                <div><strong>Editor:</strong> Content editing permissions</div>
              </div>
            </div> */}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
