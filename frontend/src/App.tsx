import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import OntologyBuilder from '@/pages/OntologyBuilder';
import ObjectExplorer from '@/pages/ObjectExplorer';
import PipelineBuilder from '@/pages/PipelineBuilder';
import AIPStudio from '@/pages/AIPStudio';
import SettingsPage from '@/pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuthStore();
  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '40vh' }} />;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, fetchUser } = useAuthStore();

  useEffect(() => {
    if (token) fetchUser();
  }, [token]);

  return (
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
                <Route path="/aip" element={<AIPStudio />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
