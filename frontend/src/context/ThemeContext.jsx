import { createContext, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (user?.theme) {
      document.body.className = user.theme === 'dark' ? 'dark' : '';
    }
  }, [user]);

  return (
    <ThemeContext.Provider value={{}}>
      {children}
    </ThemeContext.Provider>
  );
};