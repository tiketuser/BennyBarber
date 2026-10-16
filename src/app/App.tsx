import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import { useSession } from '@/data/store';
import { DeskLogin } from '@/features/auth/DeskLogin';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CustomerApp } from '@/features/customer/CustomerApp';
import { AdminApp } from '@/features/admin/AdminApp';
import { OverlayHost } from '@/ui/Overlay';
import { ToastProvider } from '@/ui/Toast';
import { useIsDesktop } from '@/ui/useIsDesktop';
import { useOnChange } from '@/ui/useOnChange';
import { DeskAdminApp } from '@/features/admin/desktop/DeskAdminApp';
import { DeskCustomerApp } from '@/features/customer/desktop/DeskCustomerApp';
import { AppShell } from './AppShell';

/**
 * Routes by session: login → customer app, or admin app when the phone number is an admin's.
 * The device decides the layout: phone screens below `lg`, desktop pages from `lg` up.
 */
export function App() {
  const session = useSession();
  // The login screen stays up after the code is verified, until its last step hands over.
  const [loggingIn, setLoggingIn] = useState(!session || (session.role === 'customer' && !session.name));
  useOnChange(!session, (signedOut) => signedOut && setLoggingIn(true));
  const showLogin = !session || loggingIn;
  const desktop = useIsDesktop();

  return (
    <MotionConfig reducedMotion="user">
      <AppShell wide={desktop}>
        <OverlayHost>
          <ToastProvider>
            {showLogin ? (
              desktop ? (
                <DeskLogin onDone={() => setLoggingIn(false)} />
              ) : (
                <LoginScreen onDone={() => setLoggingIn(false)} />
              )
            ) : session.role === 'admin' ? (
              desktop ? (
                <DeskAdminApp key="admin" />
              ) : (
                <AdminApp key="admin" />
              )
            ) : desktop ? (
              <DeskCustomerApp key={session.phone} />
            ) : (
              <CustomerApp key={session.phone} />
            )}
          </ToastProvider>
        </OverlayHost>
      </AppShell>
    </MotionConfig>
  );
}
