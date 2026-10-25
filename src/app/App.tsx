import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { useSession } from '@/data/store';
import { DeskLogin } from '@/features/auth/DeskLogin';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CustomerApp } from '@/features/customer/CustomerApp';
import { AdminApp } from '@/features/admin/AdminApp';
import { OverlayHost } from '@/ui/Overlay';
import { ToastProvider } from '@/ui/Toast';
import { useIsDesktop } from '@/ui/useIsDesktop';
import { DeskAdminApp } from '@/features/admin/desktop/DeskAdminApp';
import { DeskCustomerApp } from '@/features/customer/desktop/DeskCustomerApp';
import { TrialEnded } from '@/features/trial/TrialEnded';
import { trialEnded } from '@/config/shop';
import { AppShell } from './AppShell';
import { useLogoIcons } from './useLogoIcons';

/**
 * Routes by session: login → customer app, or admin app when the phone number is an admin's.
 * The device decides the layout: phone screens below `lg`, desktop pages from `lg` up.
 */
export function App() {
  const session = useSession();
  useLogoIcons();
  // The login screen stays up after the code is verified, until its last step hands over.
  const [loggingIn, setLoggingIn] = useState(!session || (session.role === 'customer' && !session.name));
  // In an effect, not during render: a render-phase update next to useSyncExternalStore can leave React thinking the
  // session never changed, so a later sign-out would not re-render (React 18).
  useEffect(() => {
    if (!session) setLoggingIn(true);
  }, [session]);
  const showLogin = !session || loggingIn;
  const desktop = useIsDesktop();
  // A trial shop after its free week: a notice instead of booking; "כניסה לבעל העסק" opens the login for the owner.
  const ended = trialEnded();
  const [ownerLogin, setOwnerLogin] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <AppShell wide={desktop}>
        <OverlayHost>
          <ToastProvider>
            {ended && !(showLogin && ownerLogin) ? (
              <TrialEnded admin={!showLogin && session.role === 'admin'} onOwnerLogin={() => setOwnerLogin(true)} />
            ) : showLogin ? (
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
