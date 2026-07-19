/** Role checks against the Frappe boot payload (roles of the logged-in user). */

export const hasRavenAdminRole = (): boolean =>
    (window?.frappe?.boot?.user?.roles ?? []).includes("Raven Admin")

export const isSystemManager = (): boolean =>
    (window?.frappe?.boot?.user?.roles ?? []).includes("System Manager")
