import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [darkMode,   setDarkMode]   = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)   // mobile drawer
  const [collapsed,   setCollapsed]   = useState(false)   // desktop collapse

  // Sync dark mode to <html> class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <AppContext.Provider value={{
      darkMode, setDarkMode,
      sidebarOpen, setSidebarOpen,
      collapsed,   setCollapsed,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
