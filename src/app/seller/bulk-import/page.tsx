'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useBulkImportJobs,
  useBulkImportJob,
  useInitiateBulkUpload,
  useMarkBulkUploadComplete,
  useExecuteBulkImport,
} from '@/hooks/useCommerce'

const CSV_HEADERS =
  'sku,title,mrp,selling_price,stock_qty,brand_name,manufacturer_name,hsn_code,country_of_origin,cost_price,weight_grams,length_cm,width_cm,height_cm,option_1_name,option_1_value,option_2_name,option_2_value,tier_min_qty_1,tier_price_1,tier_min_qty_2,tier_price_2,tier_min_qty_3,tier_price_3'

const STATUS_COLOR: Record<string, string> = {
  uploaded: 'bg-amber-100 text-amber-800',
  validating: 'bg-blue-100 text-blue-800',
  validation_failed: 'bg-red-100 text-red-700',
  ready_to_import: 'bg-emerald-100 text-emerald-700',
  importing: 'bg-blue-100 text-blue-800',
  partially_imported: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

export default function BulkImportPage() {
  const { data: jobsData, refetch } = useBulkImportJobs()
  const initiate = useInitiateBulkUpload()
  const markComplete = useMarkBulkUploadComplete()
  const execute = useExecuteBulkImport()
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const jobs = jobsData?.jobs ?? []
  const activeJob = useBulkImportJob(activeJobId ?? undefined)

  const handleFile = async (file: File) => {
    setUploadError(null)
    setUploadProgress('Requesting upload URL…')
    try {
      const { job_id, upload_url } = await initiate.mutateAsync(file.name)
      setActiveJobId(job_id)
      setUploadProgress('Uploading CSV…')
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'text/csv' },
      })
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`)
      }
      setUploadProgress('Validating…')
      await markComplete.mutateAsync(job_id)
      setUploadProgress(null)
      refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setUploadError(msg)
      setUploadProgress(null)
    }
  }

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-secondary">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Link
            href="/seller/dashboard"
            className="text-xs font-black tracking-widest text-primary-ink hover:text-foreground transition mb-1 block"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-black text-foreground">Bulk SKU Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a CSV to create or update many products at once. Required columns:{' '}
            <span className="font-mono">sku, title, mrp, selling_price, stock_qty</span>.
            Optional tier columns let you set quantity discounts in the same upload.
          </p>

          <div className="mt-4 bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black tracking-widest text-muted-foreground">
                Upload a new CSV
              </h2>
              <button
                onClick={() => {
                  const blob = new Blob([CSV_HEADERS + '\n'], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'bulk-import-template.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-xs font-bold text-primary-ink hover:text-foreground underline"
              >
                Download template
              </button>
            </div>
            <label className="flex items-center justify-center h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary transition">
              <span className="text-sm text-muted-foreground">
                {uploadProgress ?? 'Click or drop a .csv file to begin'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </label>
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
            {activeJob.data && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Active job <span className="font-mono">{activeJob.data.id.slice(0, 8)}…</span>
                </p>
                <p className="text-sm font-bold text-foreground">
                  Status:{' '}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                      STATUS_COLOR[activeJob.data.status] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {activeJob.data.status.replace(/_/g, ' ')}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {activeJob.data.total_rows} rows · {activeJob.data.valid_rows} valid ·{' '}
                  {activeJob.data.error_rows} errors
                </p>
                {activeJob.data.status === 'ready_to_import' && (
                  <button
                    onClick={() => execute.mutate(activeJob.data!.id)}
                    disabled={execute.isPending}
                    className="mt-3 px-5 py-2 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold tracking-wider hover:bg-foreground disabled:opacity-50"
                  >
                    {execute.isPending ? 'Importing…' : `Import ${activeJob.data.valid_rows} rows`}
                  </button>
                )}
                {activeJob.data.error_rows > 0 && (
                  <a
                    href={`/api/v1/commerce/seller/bulk-import/${activeJob.data.id}/errors.csv`}
                    className="mt-3 inline-block ml-2 text-xs font-bold text-red-600 hover:text-red-800 underline"
                  >
                    Download error report
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-xs font-black tracking-widest text-muted-foreground">
                Recent imports
              </h2>
            </div>
            {jobs.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Started
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Filename
                    </th>
                    <th className="px-4 py-2 text-[10px] font-black tracking-widest text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-black tracking-widest text-muted-foreground">
                      Rows
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-black tracking-widest text-muted-foreground">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDD3]">
                  {jobs.map((j) => (
                    <tr
                      key={j.id}
                      onClick={() => setActiveJobId(j.id)}
                      className={`cursor-pointer hover:bg-secondary/50 ${activeJobId === j.id ? 'bg-secondary' : ''}`}
                    >
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(j.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs truncate max-w-[24ch]">
                        {j.filename.split('/').slice(-1)[0]}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                            STATUS_COLOR[j.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {j.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {j.total_rows} <span className="text-muted-foreground">/ {j.imported_rows}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {j.error_rows > 0 ? (
                          <span className="text-red-600">{j.error_rows}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
