import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DevLogin from './pages/DevLogin.jsx';
import Home from './pages/Home.jsx';
import AssignScheduleGroups from './pages/coordinator/AssignScheduleGroups.jsx';
import MySchedule from './pages/student/MySchedule.jsx';
import MyCourses from './pages/student/MyCourses.jsx';
import CourseDetails from './pages/student/CourseDetails.jsx';
import SwapGroups from './pages/student/SwapGroups.jsx';
import StudentSchedules from './pages/staff/StudentSchedules.jsx';
import StudentSchedule from './pages/staff/StudentSchedule.jsx';

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
        {/* Team C3 - requirement 31: view a student's weekly schedule */}
        <Route
          path="/schedule"
          element={
            <ProtectedRoute roles={['student']}>
              <MySchedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedules"
          element={
            <ProtectedRoute roles={['advisor', 'coordinator', 'administrator']}>
              <StudentSchedules />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students/:studentId/schedule"
          element={
            <ProtectedRoute roles={['advisor', 'coordinator', 'administrator']}>
              <StudentSchedule />
            </ProtectedRoute>
          }
        />
        {/* Team C3 - requirement 32: registered courses and credit hours */}
        <Route
          path="/courses"
          element={
            <ProtectedRoute roles={['student']}>
              <MyCourses />
            </ProtectedRoute>
          }
        />
        {/* Team C3 - requirement 33: a registered course's lecture / tutorial / lab */}
        <Route
          path="/courses/:courseId"
          element={
            <ProtectedRoute roles={['student']}>
              <CourseDetails />
            </ProtectedRoute>
          }
        />
        {/* Team C3 - requirement 34: eligible groups for a whole-schedule swap */}
        <Route
          path="/swap"
          element={
            <ProtectedRoute roles={['student']}>
              <SwapGroups />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
