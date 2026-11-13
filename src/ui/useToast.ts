import { createContext, useContext } from 'react';

export interface ToastInput {
  text: string;
  action?: { label: string; run: () => void };
  tone?: 'default' | 'error';
}

export const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** Shows a short status message, optionally with an undo-style action. */
export const useToast = () => useContext(ToastContext);
