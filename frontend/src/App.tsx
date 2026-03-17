import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/authStore';

const AppLayout = lazy(() => import('@/components/AppLayout'));
const LoginPage = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const OntologyBuilder = lazy(() => import('@/pages/OntologyBuilder'));
const ObjectExplorer = lazy(() => import('@/pages/ObjectExplorer'));
const PipelineBuilder = lazy(() => import('@/pages/PipelineBuilder'));
const AIPStudio = lazy(() => import('@/pages/AIPStudio'));
const Workshop = lazy(() => import('@/pages/Workshop'));
const WorkshopBuilder = lazy(() => import('@/pages/WorkshopBuilder'));
const WorkshopView = lazy(() => import('@/pages/WorkshopView'));
const SettingsPage = lazy(() => import('@/pages/Settings'));

const routeLoadingFallback = (
  <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '40vh' }} />
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuthStore();
  if (loading) return routeLoadingFallback;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, fetchUser } = useAuthStore();

  useEffect(() => {
    if (token) fetchUser();
  }, [token]);

  return (
    <Suspense fallback={routeLoadingFallback}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/ontology" element={<OntologyBuilder />} />
                  <Route path="/explorer" element={<ObjectExplorer />} />
                  <Route path="/pipelines" element={<PipelineBuilder />} />
                  <Route path="/workshop" element={<Workshop />} />
                  <Route path="/workshop/:id" element={<WorkshopView />} />
                  <Route path="/workshop/:id/edit" element={<WorkshopBuilder />} />
                  <Route path="/aip" element={<AIPStudio />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
