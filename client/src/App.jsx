import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DevLogin from './pages/DevLogin.jsx';
import Home from './pages/Home.jsx';
import AssignScheduleGroups from './pages/coordinator/AssignScheduleGroups.jsx';

// Keep this file small and ADDITIVE: add your own <Route> below the comment of
// your feature area and do not reorder anybody else's lines.
export default function App() {
  return (
    <Routes>
      {/* TEMPORARY: replace with the real /login page from requirement 1 (team A1). */}
      <Route path="/dev-login" element={<DevLogin />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* Team C3 - scheduling */}
        <Route
          path="/coordinator/assign-groups"
          element={
            <ProtectedRoute roles={['coordinator', 'administrator']}>
              <AssignScheduleGroups />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
