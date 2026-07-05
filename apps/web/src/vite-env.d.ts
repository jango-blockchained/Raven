/// <reference types="vite/client" />

interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    frappe?: any,
    /** Injected by the Jinja entry template (raven_v3.html) for POSTs outside frappe-react-sdk */
    csrf_token?: string,
}