// The "thinking speed" the student picked (Fast / Balanced / Deep). Remembered in localStorage
// and sent to the server with every AI request.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { loadString, saveString } from '../utils/storage.js';

export const SPEEDS = [
  { value: 'fast', label: 'Fast', hint: 'Quick answers for everyday questions' },
  { value: 'balanced', label: 'Medium', hint: 'More careful, a bit slower' },
  { value: 'deep', label: 'High', hint: 'Deepest thinking, slowest. Best for hard problems' },
];

const SpeedContext = createContext({ speed: 'fast', setSpeed() {} });

export function SpeedProvider({ children }) {
  const [speed, setSpeedState] = useState(() => {
    const saved = loadString('speed', 'fast');
    return SPEEDS.some((s) => s.value === saved) ? saved : 'fast';
  });

  const setSpeed = useCallback((value) => {
    setSpeedState(value);
    saveString('speed', value);
  }, []);

  const value = useMemo(() => ({ speed, setSpeed }), [speed, setSpeed]);
  return <SpeedContext.Provider value={value}>{children}</SpeedContext.Provider>;
}

export const useSpeed = () => useContext(SpeedContext);
