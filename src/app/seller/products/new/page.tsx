'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import {
  useCreateProduct,
  useAddProductMedia,
  useSetProductAttributes,
  useSubmitProduct,
  type CreateProductPayload,
} from '@/hooks/useSellerDashboard'
import { useCategories } from '@/hooks/useCommerce'
import { uploadMedia } from '@/lib/mediaUpload'

const inputCls = 'w-full border border-[#E8DDD3] rounded-xl px-4 py-3 text-[#1A1A1A] bg-white focus:ring-2 focus:ring-[#8B5E3C]/20 focus:border-[#8B5E3C] outline-none transition-all text-sm font-medium placeholder:text-[#6B5544]/30'
const labelCls = 'block text-[10px] font-black uppercase tracking-widest text-[#6B5544] mb-1.5'

type Variant = {
  sku: string
  mrp: string
  selling_price: string
  stock_qty: string
  cost_price: string
  option_1_name: string
  option_1_value: string
  option_2_name: string
  option_2_value: string
}

type Attribute = { name: string; value: string; unit: string }
type GalleryItem = { mediaId: string; previewUrl: string; mediaType: 'image' | 'video' }

const emptyVariant = (): Variant => ({
  sku: '',
  mrp: '',
  selling_price: '',
  stock_qty: '0',
  cost_price: '',
  option_1_name: '',
  option_1_value: '',
  option_2_name: '',
  option_2_value: '',
})

const STEPS = ['Basics', 'Compliance', 'Variants', 'Media & Submit'] as const

export default function NewProductPage() {
  const router = useRouter()
  const createProduct = useCreateProduct()
  const addMedia = useAddProductMedia()
  const setAttrs = useSetProductAttributes()
  const submitProduct = useSubmitProduct()
  const categoriesQuery = useCategories()

  const [step, setStep] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [savingState, setSavingState] = useState<string | null>(null)

  // Step 1 — Basics
  const [title, setTitle] = useState('')
  const [shortTitle, setShortTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productType, setProductType] = useState('simple')
  const [brandName, setBrandName] = useState('')
  const [manufacturerName, setManufacturerName] = useState('')
  const [condition, setCondition] = useState('new')

  // Step 2 — Compliance
  const [hsnCode, setHsnCode] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('India')
  const [warrantyInfo, setWarrantyInfo] = useState('')
  const [returnPolicyType, setReturnPolicyType] = useState('returnable')
  const [returnPolicyDays, setReturnPolicyDays] = useState('7')
  const [weightGrams, setWeightGrams] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [searchKeywords, setSearchKeywords] = useState('')
  const [attributes, setAttributes] = useState<Attribute[]>([])

  // Step 3 — Variants
  const [variants, setVariants] = useState<Variant[]>([emptyVariant()])

  // Step 4 — Media
  const [primaryImage, setPrimaryImage] = useState<GalleryItem | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [videoItem, setVideoItem] = useState<GalleryItem | null>(null)

  const categories = categoriesQuery.data ?? []

  const canProceedStep0 = title.trim().length >= 3
  const canProceedStep2 = variants.every(v => v.sku && v.mrp && v.selling_price)
  const canSubmit = canProceedStep0 && canProceedStep2 && !!primaryImage

  const goNext = () => {
    setError(null)
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const goBack = () => {
    setError(null)
    setStep(s => Math.max(s - 1, 0))
  }

  const updateVariant = (i: number, patch: Partial<Variant>) => {
    setVariants(prev => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }
  const removeVariant = (i: number) => {
    setVariants(prev => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  const handleImagePick = async (file: File, target: 'primary' | 'gallery' | 'video') => {
    setError(null)
    setSavingState(`Uploading ${target}…`)
    try {
      const fileType: 'image' | 'video' = target === 'video' ? 'video' : 'image'
      const subtype = target === 'primary' ? 'cover' : 'general'
      const mediaId = await uploadMedia(file, fileType, subtype)
      const previewUrl = URL.createObjectURL(file)
      const item: GalleryItem = { mediaId, previewUrl, mediaType: fileType }
      if (target === 'primary') setPrimaryImage(item)
      else if (target === 'video') setVideoItem(item)
      else setGallery(prev => [...prev, item])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
    } finally {
      setSavingState(null)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError(null)
    try {
      const trimmedKeywords = searchKeywords
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      const payload: CreateProductPayload = {
        title: title.trim(),
        short_title: shortTitle.trim() || undefined,
        description: description.trim() || undefined,
        short_description: shortDescription.trim() || undefined,
        category_id: categoryId || undefined,
        product_type: productType,
        condition,
        brand_name: brandName.trim() || undefined,
        manufacturer_name: manufacturerName.trim() || undefined,
        hsn_code: hsnCode.trim() || undefined,
        country_of_origin: countryOfOrigin.trim() || undefined,
        warranty_info: warrantyInfo.trim() || undefined,
        return_policy_type: returnPolicyType,
        return_policy_days: parseInt(returnPolicyDays || '0', 10) || undefined,
        primary_image_media_id: primaryImage?.mediaId,
        video_media_id: videoItem?.mediaId,
        weight_grams: weightGrams ? parseInt(weightGrams, 10) : undefined,
        length_cm: lengthCm ? parseFloat(lengthCm) : undefined,
        width_cm: widthCm ? parseFloat(widthCm) : undefined,
        height_cm: heightCm ? parseFloat(heightCm) : undefined,
        search_keywords: trimmedKeywords.length ? trimmedKeywords : undefined,
        variants: variants.map(v => ({
          sku: v.sku.trim(),
          mrp: parseFloat(v.mrp),
          selling_price: parseFloat(v.selling_price),
          stock_qty: v.stock_qty ? parseInt(v.stock_qty, 10) : 0,
          cost_price: v.cost_price ? parseFloat(v.cost_price) : undefined,
          option_1_name: v.option_1_name || undefined,
          option_1_value: v.option_1_value || undefined,
          option_2_name: v.option_2_name || undefined,
          option_2_value: v.option_2_value || undefined,
        })),
      }

      setSavingState('Creating product…')
      const created = await createProduct.mutateAsync(payload)

      // Gallery + attributes are best-effort follow-ups — the product
      // exists at this point. Surface failures but don't roll back.
      if (gallery.length) {
        setSavingState('Attaching gallery…')
        let i = 0
        for (const g of gallery) {
          try {
            await addMedia.mutateAsync({ productId: created.id, mediaId: g.mediaId, sortOrder: i + 1 })
          } catch (e) {
            console.warn('gallery attach failed', e)
          }
          i += 1
        }
      }
      const cleanAttrs = attributes.filter(a => a.name && a.value)
      if (cleanAttrs.length) {
        setSavingState('Saving attributes…')
        try {
          await setAttrs.mutateAsync({
            productId: created.id,
            attributes: cleanAttrs.map(a => ({ name: a.name, value: a.value, unit: a.unit || undefined })),
          })
        } catch (e) {
          console.warn('attributes save failed', e)
        }
      }
      setSavingState('Submitting for review…')
      try {
        await submitProduct.mutateAsync(created.id)
      } catch (e) {
        console.warn('submit-for-review failed; product still saved as draft', e)
      }
      router.push('/seller/products')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Create failed'
      setError(message)
    } finally {
      setSavingState(null)
    }
  }

  const stepperBar = useMemo(
    () => (
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-black ${
                i === step
                  ? 'bg-[#1A1A1A] text-white'
                  : i < step
                    ? 'bg-[#8B5E3C] text-white'
                    : 'bg-[#E8DDD3] text-[#6B5544]'
              }`}
            >
              {i + 1}
            </div>
            <div className="ml-2 text-[10px] font-black uppercase tracking-widest text-[#4A3728] hidden sm:block">
              {label}
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-[2px] bg-[#E8DDD3] mx-3" />}
          </div>
        ))}
      </div>
    ),
    [step]
  )

  return (
    <AppShell activeTab="Shop">
      <div className="min-h-screen bg-[#F5F0EB]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href="/seller/products"
            className="text-xs font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition mb-4 block"
          >
            ← Products
          </Link>
          <h1 className="text-2xl font-black text-[#1A1A1A] mb-1">Add New Product</h1>
          <p className="text-sm text-[#6B5544] mb-6">
            Fill every step. Compliance fields are checked by moderators before your listing goes live.
          </p>

          <div className="bg-white rounded-2xl border border-[#E8DDD3] p-8">
            {stepperBar}

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}
            {savingState && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">
                {savingState}
              </div>
            )}

            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Product Title *</label>
                  <input
                    required
                    className={inputCls}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Handmade Ceramic Mug"
                  />
                </div>
                <div>
                  <label className={labelCls}>Short Title</label>
                  <input
                    className={inputCls}
                    value={shortTitle}
                    onChange={e => setShortTitle(e.target.value)}
                    placeholder="Compact title shown in lists"
                  />
                </div>
                <div>
                  <label className={labelCls}>Short Description</label>
                  <input
                    className={inputCls}
                    value={shortDescription}
                    onChange={e => setShortDescription(e.target.value)}
                    placeholder="One-line pitch shown above the fold"
                  />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Category</label>
                    <select
                      className={inputCls}
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                    >
                      <option value="">—</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Product Type</label>
                    <select
                      className={inputCls}
                      value={productType}
                      onChange={e => setProductType(e.target.value)}
                    >
                      <option value="simple">Simple</option>
                      <option value="variable">Variable</option>
                      <option value="digital">Digital</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Brand Name</label>
                    <input
                      className={inputCls}
                      value={brandName}
                      onChange={e => setBrandName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Manufacturer Name</label>
                    <input
                      className={inputCls}
                      value={manufacturerName}
                      onChange={e => setManufacturerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Condition</label>
                    <select
                      className={inputCls}
                      value={condition}
                      onChange={e => setCondition(e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="used">Used</option>
                      <option value="refurbished">Refurbished</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>HSN Code</label>
                    <input
                      className={inputCls}
                      value={hsnCode}
                      onChange={e => setHsnCode(e.target.value)}
                      placeholder="e.g. 6109"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Country of Origin</label>
                    <input
                      className={inputCls}
                      value={countryOfOrigin}
                      onChange={e => setCountryOfOrigin(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Warranty Info</label>
                  <input
                    className={inputCls}
                    value={warrantyInfo}
                    onChange={e => setWarrantyInfo(e.target.value)}
                    placeholder="e.g. 1 year manufacturer warranty"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Return Policy</label>
                    <select
                      className={inputCls}
                      value={returnPolicyType}
                      onChange={e => setReturnPolicyType(e.target.value)}
                    >
                      <option value="returnable">Returnable</option>
                      <option value="non_returnable">Non-returnable</option>
                      <option value="exchange_only">Exchange only</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Return Window (days)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={returnPolicyDays}
                      onChange={e => setReturnPolicyDays(e.target.value)}
                    />
                  </div>
                </div>
                <div className="border-t border-[#E8DDD3] pt-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#4A3728] mb-3">
                    Shipping dimensions
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className={labelCls}>Weight (g)</label>
                      <input
                        type="number"
                        min="0"
                        className={inputCls}
                        value={weightGrams}
                        onChange={e => setWeightGrams(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Length (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className={inputCls}
                        value={lengthCm}
                        onChange={e => setLengthCm(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Width (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className={inputCls}
                        value={widthCm}
                        onChange={e => setWidthCm(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Height (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className={inputCls}
                        value={heightCm}
                        onChange={e => setHeightCm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Search Keywords (comma-separated)</label>
                  <input
                    className={inputCls}
                    value={searchKeywords}
                    onChange={e => setSearchKeywords(e.target.value)}
                    placeholder="ceramic, mug, handmade, kitchen"
                  />
                </div>
                <div className="border-t border-[#E8DDD3] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#4A3728]">
                      Attributes / Specs
                    </h4>
                    <button
                      type="button"
                      onClick={() => setAttributes(prev => [...prev, { name: '', value: '', unit: '' }])}
                      className="text-[10px] font-black uppercase tracking-widest text-[#8B5E3C] hover:text-[#1A1A1A] transition"
                    >
                      + Add row
                    </button>
                  </div>
                  {attributes.length === 0 && (
                    <p className="text-xs text-[#6B5544]/70 italic">
                      No attributes yet. Add specs like Material, Capacity, Colour…
                    </p>
                  )}
                  {attributes.map((a, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 mb-2">
                      <input
                        placeholder="Name"
                        className={inputCls}
                        value={a.name}
                        onChange={e =>
                          setAttributes(prev => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                        }
                      />
                      <input
                        placeholder="Value"
                        className={inputCls}
                        value={a.value}
                        onChange={e =>
                          setAttributes(prev => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))
                        }
                      />
                      <input
                        placeholder="Unit"
                        className={inputCls}
                        value={a.unit}
                        onChange={e =>
                          setAttributes(prev => prev.map((x, idx) => (idx === i ? { ...x, unit: e.target.value } : x)))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setAttributes(prev => prev.filter((_, idx) => idx !== i))}
                        className="px-3 text-[#6B5544] hover:text-red-600 transition"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {variants.map((v, i) => (
                  <div key={i} className="border border-[#E8DDD3] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-[#4A3728]">
                        Variant {i + 1}
                      </h4>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(i)}
                          className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800 transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>SKU *</label>
                        <input
                          required
                          className={inputCls}
                          value={v.sku}
                          onChange={e => updateVariant(i, { sku: e.target.value })}
                          placeholder="MUG-001"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Stock Qty</label>
                        <input
                          type="number"
                          min="0"
                          className={inputCls}
                          value={v.stock_qty}
                          onChange={e => updateVariant(i, { stock_qty: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>MRP (₹) *</label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputCls}
                          value={v.mrp}
                          onChange={e => updateVariant(i, { mrp: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Selling Price (₹) *</label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputCls}
                          value={v.selling_price}
                          onChange={e => updateVariant(i, { selling_price: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Cost Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputCls}
                          value={v.cost_price}
                          onChange={e => updateVariant(i, { cost_price: e.target.value })}
                          placeholder="Internal — not shown to buyers"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-3">
                      <input
                        placeholder="Option 1 name"
                        className={inputCls}
                        value={v.option_1_name}
                        onChange={e => updateVariant(i, { option_1_name: e.target.value })}
                      />
                      <input
                        placeholder="Option 1 value"
                        className={inputCls}
                        value={v.option_1_value}
                        onChange={e => updateVariant(i, { option_1_value: e.target.value })}
                      />
                      <input
                        placeholder="Option 2 name"
                        className={inputCls}
                        value={v.option_2_name}
                        onChange={e => updateVariant(i, { option_2_name: e.target.value })}
                      />
                      <input
                        placeholder="Option 2 value"
                        className={inputCls}
                        value={v.option_2_value}
                        onChange={e => updateVariant(i, { option_2_value: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setVariants(prev => [...prev, emptyVariant()])}
                  className="w-full py-3 border-2 border-dashed border-[#E8DDD3] rounded-xl text-[#6B5544] font-bold hover:bg-[#F5F0EB] transition text-sm"
                >
                  + Add another variant
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label className={labelCls}>Primary Image *</label>
                  {primaryImage ? (
                    <div className="flex items-center gap-3">
                      <img src={primaryImage.previewUrl} alt="primary" className="w-24 h-24 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(null)}
                        className="text-xs font-black uppercase tracking-widest text-red-600 hover:text-red-800 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[#E8DDD3] rounded-xl cursor-pointer hover:bg-[#F5F0EB] transition">
                      <span className="text-sm font-medium text-[#6B5544]">Click to upload primary image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleImagePick(e.target.files[0], 'primary')}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Gallery</label>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {gallery.map((g, i) => (
                      <div key={g.mediaId} className="relative">
                        <img src={g.previewUrl} alt={`gallery ${i + 1}`} className="w-full aspect-square object-cover rounded-xl" />
                        <button
                          type="button"
                          onClick={() => setGallery(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-2 -right-2 bg-white border border-[#E8DDD3] rounded-full w-6 h-6 text-[#6B5544] hover:text-red-600 transition"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-[#E8DDD3] rounded-xl cursor-pointer hover:bg-[#F5F0EB] transition">
                    <span className="text-sm font-medium text-[#6B5544]">+ Add gallery image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleImagePick(e.target.files[0], 'gallery')}
                    />
                  </label>
                </div>

                <div>
                  <label className={labelCls}>Product Video (optional)</label>
                  {videoItem ? (
                    <div className="flex items-center gap-3">
                      <video src={videoItem.previewUrl} className="w-32 h-32 object-cover rounded-xl bg-black" />
                      <button
                        type="button"
                        onClick={() => setVideoItem(null)}
                        className="text-xs font-black uppercase tracking-widest text-red-600 hover:text-red-800 transition"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-[#E8DDD3] rounded-xl cursor-pointer hover:bg-[#F5F0EB] transition">
                      <span className="text-sm font-medium text-[#6B5544]">+ Upload demo video</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleImagePick(e.target.files[0], 'video')}
                      />
                    </label>
                  )}
                </div>

                <div className="border-t border-[#E8DDD3] pt-4">
                  <p className="text-xs text-[#6B5544] mb-3">
                    On submit, your product is saved and sent to the moderation queue. You can keep editing while it
                    awaits review.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-[#E8DDD3]">
              <div>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-5 py-3 border border-[#E8DDD3] rounded-xl text-[#6B5544] font-bold hover:bg-[#F5F0EB] transition text-sm"
                  >
                    Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/seller/products"
                  className="px-5 py-3 text-[#6B5544] font-bold hover:text-[#1A1A1A] transition text-sm"
                >
                  Cancel
                </Link>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={step === 0 ? !canProceedStep0 : step === 2 ? !canProceedStep2 : false}
                    className="px-8 py-3 bg-[#1A1A1A] text-white rounded-xl font-bold hover:bg-[#3A2E26] disabled:opacity-50 transition text-sm"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit || createProduct.isPending || !!savingState}
                    className="px-8 py-3 bg-[#8B5E3C] text-white rounded-xl font-bold hover:bg-[#3A2E26] disabled:opacity-50 transition text-sm"
                  >
                    {createProduct.isPending || savingState ? 'Saving…' : 'Save & Submit for Review'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
