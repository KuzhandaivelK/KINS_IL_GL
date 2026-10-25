import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { IndividualLifePage } from './pages/IndividualLifePage';
import { GroupLifePage } from './pages/GroupLifePage';
import { PlaceholderModulePage } from './pages/PlaceholderModulePage';
import { UsersPage } from './pages/UsersPage';
import { MenusPage } from './pages/MenusPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes wrapped in AppLayout and ProtectedRoute */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/individual-life" element={<IndividualLifePage />} />
            <Route path="/group-life" element={<GroupLifePage />} />
            <Route path="/product-configuration" element={<PlaceholderModulePage />} />
            <Route path="/policy-administration" element={<PlaceholderModulePage />} />
            <Route path="/underwriting" element={<PlaceholderModulePage />} />
            <Route path="/premium-collection" element={<PlaceholderModulePage />} />
            <Route path="/claims-management" element={<PlaceholderModulePage />} />
            <Route path="/commission-management" element={<PlaceholderModulePage />} />
            <Route path="/reinsurance" element={<PlaceholderModulePage />} />
            <Route path="/reports" element={<PlaceholderModulePage />} />
            <Route path="/administration" element={<PlaceholderModulePage />} />
            <Route path="/administration/users" element={<UsersPage />} />
            <Route path="/administration/menus" element={<MenusPage />} />
          </Route>

          {/* Root Redirect to /dashboard (which redirects to /login if unauthenticated) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Fallback unknown paths */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
