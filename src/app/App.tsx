import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import { useSession } from '@/data/store';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CustomerApp } from '@/features/customer/CustomerApp';
import { AdminApp } from '@/features/admin/AdminApp';
import { OverlayHost } from '@/ui/Overlay';
import { ToastProvider } from '@/ui/Toast';
import { useOnChange } from '@/ui/useOnChange';
import { AppShell } from './AppShell';

/** Routes by session: login → customer app, or admin app when the phone number is an admin's. */
export function App() {
  const session = useSession();
  // The login screen stays up after the code is verified, until its last step hands over.
  const [loggingIn, setLoggingIn] = useState(!session || (session.role === 'customer' && !session.name));
  useOnChange(!session, (signedOut) => signedOut && setLoggingIn(true));
  const showLogin = !session || loggingIn;

  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <OverlayHost>
          <ToastProvider>
            {showLogin ? (
              <LoginScreen onDone={() => setLoggingIn(false)} />
            ) : session.role === 'admin' ? (
              <AdminApp key="admin" />
            ) : (
              <CustomerApp key={session.phone} />
            )}
          </ToastProvider>
        </OverlayHost>
      </AppShell>
    </MotionConfig>
  );
}
