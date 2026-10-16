import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { useSession } from '@/data/store';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CustomerApp } from '@/features/customer/CustomerApp';
import { AdminApp } from '@/features/admin/AdminApp';
import { OverlayHost } from '@/ui/Overlay';
import { ToastProvider } from '@/ui/Toast';
import { DeviceShell } from './DeviceShell';

/** Routes by session: login → customer app, or admin app when the phone number is an admin's. */
export function App() {
  const session = useSession();
  const [inLogin, setInLogin] = useState(!session || (session.role === 'customer' && !session.name));

  useEffect(() => {
    if (!session) setInLogin(true);
  }, [session]);

  // Demo toolbar (desktop) jumps straight into a view.
  useEffect(() => {
    const leave = () => setInLogin(false);
    window.addEventListener('bb:dev-switch', leave);
    return () => window.removeEventListener('bb:dev-switch', leave);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <DeviceShell>
        <OverlayHost>
          <ToastProvider>
            {inLogin || !session ? (
              <LoginScreen onDone={() => setInLogin(false)} />
            ) : session.role === 'admin' ? (
              <AdminApp key="admin" />
            ) : (
              <CustomerApp key={session.phone} />
            )}
          </ToastProvider>
        </OverlayHost>
      </DeviceShell>
    </MotionConfig>
  );
}
