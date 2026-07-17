import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import OverviewPage from './pages/OverviewPage'
import PlansPage from './pages/PlansPage'
import PlanPage from './pages/PlanPage'
import DayPage from './pages/DayPage'
import WorkoutPage from './pages/WorkoutPage'
import ExercisesPage from './pages/ExercisesPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import NavIcon from './components/NavIcon'
import { cleanupEmptySessions, dedupeExerciseDefs, seedExerciseLibraryIfNeeded } from './db/db'
import './App.css'

function App() {
  useEffect(() => {
    dedupeExerciseDefs().then(() => seedExerciseLibraryIfNeeded())
    cleanupEmptySessions()
  }, [])

  return (
    <div className="app">
      <main className="app-content">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/plaene" element={<PlansPage />} />
          <Route path="/plans/:planId" element={<PlanPage />} />
          <Route path="/plans/:planId/days/:dayId" element={<DayPage />} />
          <Route path="/plans/:planId/days/:dayId/workout" element={<WorkoutPage />} />
          <Route path="/uebungen" element={<ExercisesPage />} />
          <Route path="/statistik" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <NavIcon name="home" />
          Übersicht
        </NavLink>
        <NavLink to="/plaene" className={({ isActive }) => (isActive ? 'active' : '')}>
          <NavIcon name="plans" />
          Pläne
        </NavLink>
        <NavLink to="/uebungen" className={({ isActive }) => (isActive ? 'active' : '')}>
          <NavIcon name="exercises" />
          Übungen
        </NavLink>
        <NavLink to="/statistik" className={({ isActive }) => (isActive ? 'active' : '')}>
          <NavIcon name="progress" />
          Fortschritt
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <NavIcon name="settings" />
          Einstellungen
        </NavLink>
      </nav>
    </div>
  )
}

export default App
