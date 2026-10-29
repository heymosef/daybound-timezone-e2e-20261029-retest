import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/index.css'
import { AnalyticsProvider } from './analytics/AnalyticsProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AnalyticsProvider options={{
      token: import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
      host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      production: import.meta.env.PROD && !import.meta.env.DEV && import.meta.env.MODE !== 'test',
      hostname: window.location.hostname,
    }}>
      <App />
    </AnalyticsProvider>
  </React.StrictMode>,
)
