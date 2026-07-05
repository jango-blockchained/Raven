import { scan } from "react-scan";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from "./components/theme-provider"

scan({
  enabled: true,
});


import { initPushNotifications } from "@lib/push";

if (import.meta.env.DEV) {
  fetch('/api/method/raven.www.raven.get_context_for_dev', {
    method: 'POST',
  })
    .then(response => response.json())
    .then((values) => {
      const v = JSON.parse(values.message)
      if (!window.frappe) window.frappe = {};
      window.frappe.boot = v
      window.frappe._messages = window.frappe.boot["__messages"];
      // After boot lands — push config (firebase_client_config) comes from it
      initPushNotifications()
      createRoot(document.getElementById('root')!).render(
        <StrictMode>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </StrictMode>,
      )
    }
    )
} else {
  // Boot is inlined by the Jinja entry template, so it's already available
  initPushNotifications()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}
