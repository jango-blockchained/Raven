import { useFrappeGetCall } from "frappe-react-sdk"

export const useDocType = (doctype: string, with_parent: 0 | 1 = 1, cached_timestamp?: Date) => {

    // `locals` is a DESK global (the /app document cache). This SPA never loads desk's
    // bundle, so it is simply absent here — and a BARE `locals` throws ReferenceError
    // before `?.` can apply, which is why this reads it off `window`. Absent cache just
    // means every doctype's meta is fetched (SWR then holds it, revalidateIfStale: false).
    const localData = window.locals?.['DocType']?.[doctype] || null
    const { data, error, isLoading } = useFrappeGetCall('frappe.desk.form.load.getdoctype', {
        doctype: doctype,
        with_parent: with_parent,
        cached_timestamp: cached_timestamp ?? null,
    }, localData || !doctype ? null : undefined, {
        onSuccess: (data) => {
            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data?.docs?.forEach((d: any) => {
                    // Same story: `frappe.model` is a desk namespace. `window.frappe` DOES
                    // exist here (main.tsx seeds boot + messages), so an unguarded
                    // `frappe.model.add_to_locals` throws TypeError rather than
                    // ReferenceError. Outside desk this is a deliberate no-op.
                    window.frappe?.model?.add_to_locals?.(d)
                })
            }
        },
        revalidateIfStale: false,
        revalidateOnFocus: false,
    })

    return {
        data: localData || (data?.docs?.[0] ?? null),
        error,
        isLoading: localData ? false : isLoading
    }
}
