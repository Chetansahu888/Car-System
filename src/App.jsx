// App.jsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider, PAGE_KEYS } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PurchaseCar from './pages/PurchaseCar';
import Challans from './pages/Challans';
import Fastag from './pages/Fastag';
import Insurance from './pages/Insurance';
import CarRepair from './pages/CarRepair';
import AccidentClaims from './pages/AccidentClaims';
import VendorOffers from './pages/VendorOffers';
import Approvals from './pages/Approvals';
import DeliveryPlanning from './pages/DeliveryPlanning';
import DeliveryOfCar from './pages/DeliveryOfCar';
import Payment from './pages/Payment';
import UserManagement from './pages/UserManagement';

import { initLiveSyncService } from './store/dataStore';

function AppRoutes() {
  useEffect(() => {
    // Start real-time 2-way background synchronization with Google Sheets
    const cleanup = initLiveSyncService(6000);
    return cleanup;
  }, []);

  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<Login />} />

      {/* Protected Application Routes inside Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.DASHBOARD}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-car"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.PURCHASE_CAR}>
            <Layout>
              <PurchaseCar />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/challans"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.CHALLANS}>
            <Layout>
              <Challans />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-car/challans"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.CHALLANS}>
            <Layout>
              <Challans />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fastags"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.FASTAG}>
            <Layout>
              <Fastag />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-car/fastag"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.FASTAG}>
            <Layout>
              <Fastag />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fastag"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.FASTAG}>
            <Layout>
              <Fastag />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/insurance"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.INSURANCE}>
            <Layout>
              <Insurance />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/car-repair"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.CAR_REPAIR}>
            <Layout>
              <CarRepair />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accident-claims"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.ACCIDENT_CLAIMS}>
            <Layout>
              <AccidentClaims />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vendor-offers"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.VENDOR_OFFERS}>
            <Layout>
              <VendorOffers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.APPROVALS}>
            <Layout>
              <Approvals />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/delivery"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.DELIVERY}>
            <Layout>
              <DeliveryOfCar />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/delivery-planning"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.DELIVERY}>
            <Layout>
              <DeliveryOfCar />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment"
        element={
          <ProtectedRoute pageKey={PAGE_KEYS.PAYMENT}>
            <Layout>
              <Payment />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin Only Route */}
      <Route
        path="/users"
        element={
          <ProtectedRoute adminOnly={true}>
            <Layout>
              <UserManagement />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #d1fae5',
              borderRadius: '14px',
              fontSize: '13.5px',
              fontFamily: 'inherit',
              fontWeight: 600,
              padding: '12px 18px',
              boxShadow: '0 10px 25px rgba(5, 150, 105, 0.1)',
            },
            success: {
              iconTheme: { primary: '#059669', secondary: '#ffffff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
