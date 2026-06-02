import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный роут */}
        <Route path="/login" element={<LoginPage />} />

        {/* Защищенный роут */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/board/:boardId" 
          element={
            <ProtectedRoute>
              <div className="p-8">Страница доски (скоро напишем)</div>
            </ProtectedRoute>
          } 
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;