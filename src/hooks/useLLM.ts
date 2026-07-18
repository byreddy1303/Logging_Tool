// Thin React wrapper around callLLM: adds pending / error state, an AbortSignal
// so a stale call is cancelled when the caller kicks off a new one, and a
// `reset()` helper for form flows that want to clear prior errors on retry.
import { useCallback, useEffect, useRef, useState } from 'react';
import { callLLM, LLMError, type LLMRequest, type LLMResponse } from '@/lib/llm';

interface UseLLMState {
  pending: boolean;
  error: LLMError | null;
  data: LLMResponse | null;
}

const INITIAL: UseLLMState = { pending: false, error: null, data: null };

export function useLLM() {
  const [state, setState] = useState<UseLLMState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(async (req: LLMRequest): Promise<LLMResponse | null> => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ pending: true, error: null, data: null });
    try {
      const resp = await callLLM(req, { signal: ac.signal });
      if (!mountedRef.current || ac.signal.aborted) return null;
      setState({ pending: false, error: null, data: resp });
      return resp;
    } catch (err) {
      if (ac.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
        return null;
      }
      if (!mountedRef.current) return null;
      const wrapped =
        err instanceof LLMError
          ? err
          : new LLMError({
              message: (err as Error).message ?? 'unknown error',
              status: 0,
              code: 'unknown'
            });
      setState({ pending: false, error: wrapped, data: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, pending: false }));
  }, []);

  return { ...state, send, reset, cancel };
}
