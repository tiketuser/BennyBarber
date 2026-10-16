import { useCallback, useState } from 'react';
import { whatsappUrl } from '@/lib/links';
import { haptic, openExternal } from '@/lib/platform';

interface Outgoing {
  key: string;
  name: string;
  phone: string;
  text: string;
}

/**
 * WhatsApp messages to several people, one tap each (a web page can only open one chat at a time).
 * With the WhatsApp Business API behind Firebase Functions this becomes a single server call;
 * the UI keeps the same "sent ✓" state per person.
 */
export function useSendQueue(list: Outgoing[]) {
  const [sent, setSent] = useState<Record<string, true>>({});
  const send = useCallback(
    (o: Outgoing) => {
      openExternal(whatsappUrl(o.phone, o.text));
      haptic();
      setSent((s) => ({ ...s, [o.key]: true }));
    },
    [],
  );
  const pending = list.filter((o) => !sent[o.key]);
  return {
    isSent: (key: string) => !!sent[key],
    send,
    sendNext: () => pending[0] && send(pending[0]),
    next: pending[0] as Outgoing | undefined,
    sentCount: list.length - pending.length,
    total: list.length,
  };
}
