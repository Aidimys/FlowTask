import { Navigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { type ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallbackTo?: string;
}

export const ProtectedRoute = ({ children, fallbackTo = '/login' }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
};