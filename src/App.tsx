import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage'; // Импортируем нашу страницу
import { useAuth } from './providers/AuthProvider';

// Оставляем пока только заглушку дашборда
const DashboardPagePlaceholder = () => {
  const { user, signOut } = useAuth();
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Главная страница (Доски)</h1>
      <p className="mb-4">Добро пожаловать, <span className="font-semibold">{user?.email}</span>!</p>
      <button 
        onClick={() => signOut()} 
        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition"
      >
        Выйти из аккаунта
      </button>
    </div>
  );
};

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
              <DashboardPagePlaceholder />
            </ProtectedRoute>
          } 
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;