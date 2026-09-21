import React from 'react';
import { useStore } from '../store/useStore';
import { MaintenancePage } from '../pages/MaintenancePage';
import { useLocation } from 'react-router-dom';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export const MaintenanceGuard: React.FC<MaintenanceGuardProps> = ({ children }) => {
  const { siteSettings, isAdminAuthenticated } = useStore();
  const location = useLocation();

  // If maintenance mode is active, check permissions
  if (siteSettings?.is_maintenance_mode) {
    // Bypass if user is authenticated as Admin or currently on any admin path
    if (isAdminAuthenticated || location.pathname.startsWith('/admin')) {
      return <>{children}</>;
    }

    // Otherwise render sleek maintenance page for public visitors
    return <MaintenancePage />;
  }

  return <>{children}</>;
};
