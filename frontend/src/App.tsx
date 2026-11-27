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
import { CustomersPage } from './pages/CustomersPage';
import { TariffRatesPage } from './pages/TariffRatesPage';
import { CoversPage } from './pages/CoversPage';
import { ProductsPage } from './pages/ProductsPage';
import { QuickQuotePage } from './pages/QuickQuotePage';
import { WorkflowPage } from './pages/WorkflowPage';
import { ProposalPage } from './pages/ProposalPage';
import { PolicyPage } from './pages/PolicyPage';
import { PolicyServicingPage } from './pages/PolicyServicingPage';
import { WorkbasketPage } from './pages/WorkbasketPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { ReinsurancePage } from './pages/ReinsurancePage';

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
            <Route path="/workbasket" element={<WorkbasketPage />} />
            <Route path="/individual-life" element={<IndividualLifePage />} />
            <Route path="/individual-life/quick-quote" element={<QuickQuotePage />} />
            <Route path="/quick-quote" element={<Navigate to="/individual-life/quick-quote" replace />} />
            <Route path="/individual-life/proposal" element={<ProposalPage />} />
            <Route path="/proposal" element={<Navigate to="/individual-life/proposal" replace />} />
            <Route path="/group-life" element={<GroupLifePage />} />
            <Route path="/group-life/quote" element={<GroupLifePage />} />
            <Route path="/product-configuration" element={<Navigate to="/product-configuration/products" replace />} />
            <Route path="/product-configuration/cover" element={<CoversPage />} />
            <Route path="/product-configuration/products" element={<ProductsPage />} />
            <Route path="/policy-administration" element={<PolicyPage />} />
            <Route path="/underwriting" element={<PlaceholderModulePage />} />
            <Route path="/premium-collection" element={<PolicyServicingPage />} />
            <Route path="/policy-servicing" element={<PolicyServicingPage />} />
            <Route path="/claims-management" element={<ClaimsPage />} />
            <Route path="/commission-management" element={<PlaceholderModulePage />} />
            <Route path="/reinsurance" element={<ReinsurancePage />} />
            <Route path="/reports" element={<PlaceholderModulePage />} />
            <Route path="/administration" element={<PlaceholderModulePage />} />
            <Route path="/administration/users" element={<UsersPage />} />
            <Route path="/administration/menus" element={<MenusPage />} />
            <Route path="/administration/customers" element={<CustomersPage />} />
            <Route path="/administration/rating" element={<TariffRatesPage />} />
            <Route path="/administration/workflow" element={<WorkflowPage />} />
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
