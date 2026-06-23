import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

export default function Toast() {
  const error = useAppStore((s) => s.error);
  const clearError = useAppStore((s) => s.clearError);

  const dismiss = useCallback(() => clearError(), [clearError]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [error, dismiss]);

  if (!error) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 glass text-text px-5 py-2.5 rounded-card z-[9999] text-sm font-medium shadow-modal cursor-pointer max-w-[80%] text-center animate-[fadeIn_0.2s_ease]"
      onClick={dismiss}
      role="alert"
    >
      {error}
    </div>
  );
}
