"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Bike,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Power,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  TicketPercent,
  Truck,
  UtensilsCrossed,
  XCircle,
} from "lucide-react"
import {
  addFigoCartItem,
  applyFigoCoupon,
  cancelFigoAdminOrder,
  confirmFigoPayment,
  createFigoAdminCoupon,
  createFigoAddress,
  createFigoMenuCategory,
  createFigoMenuItem,
  createFigoPartnerRestaurant,
  createFigoServiceArea,
  createFigoPaymentIntent,
  fetchFigoAddresses,
  fetchFigoAdminAuditLogs,
  fetchFigoAdminCoupons,
  fetchFigoAdminDashboard,
  fetchFigoAdminDeliverySettlements,
  fetchFigoAdminOrders,
  fetchFigoAdminPendingDeliveryPartners,
  fetchFigoAdminPendingRestaurants,
  fetchFigoAdminRestaurantSettlements,
  fetchFigoAssignmentTracking,
  fetchFigoCart,
  fetchFigoDeliveryAssignments,
  fetchFigoCurrentDeliveryAssignment,
  fetchFigoDeliveryEarnings,
  fetchFigoDeliveryHistory,
  fetchFigoDeliveryPartner,
  fetchFigoHome,
  fetchFigoMenu,
  fetchFigoOrderTracking,
  fetchFigoOrders,
  fetchFigoPartnerOrders,
  fetchFigoPartnerRestaurants,
  fetchFigoPartnerSettlements,
  fetchFigoPartnerSummary,
  fetchFigoRevenueReport,
  fetchFigoServiceAreas,
  generateFigoAdminSettlements,
  placeFigoOrder,
  rateFigoDelivery,
  rateFigoRestaurant,
  refundFigoAdminOrder,
  reviewFigoAdminDeliveryPartner,
  reviewFigoAdminRestaurant,
  setFigoDeliveryAvailability,
  markFigoAdminDeliverySettlementPaid,
  markFigoAdminRestaurantSettlementPaid,
  updateFigoDeliveryLocation,
  updateFigoDeliveryAssignment,
  updateFigoPartnerOrder,
  upsertFigoDeliveryPartner,
  type FigoMenuItem,
  type FigoLocationPoint,
  type FigoOrder,
  type FigoOrderTracking,
  type FigoRestaurant,
} from "@/features/figo/api"
import { openRazorpayCheckout } from "@/lib/razorpay"

function money(value: number | undefined) {
  return `Rs ${(value ?? 0).toFixed(0)}`
}

function todayISO(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function stringField(input: Record<string, unknown> | null | undefined, key: string) {
  const value = input?.[key]
  return value == null ? "" : String(value)
}

function numberField(input: Record<string, unknown> | null | undefined, key: string) {
  const value = input?.[key]
  return typeof value === "number" ? value : Number(value ?? 0)
}

function RestaurantCard({
  restaurant,
  onOpen,
}: {
  restaurant: FigoRestaurant
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] bg-orange-50">
        {restaurant.hero_image_url ? (
          <img
            src={restaurant.hero_image_url}
            alt={restaurant.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-orange-700">
            <UtensilsCrossed className="h-9 w-9" />
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-900 shadow">
          {restaurant.is_open ? "Open now" : "Closed"}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-base font-bold text-neutral-950">
              {restaurant.name}
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
              <Star className="h-3.5 w-3.5 fill-emerald-600" />
              {restaurant.avg_rating.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-neutral-500">
            {restaurant.cuisines.join(" - ")}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1 rounded-md bg-neutral-50 px-2 py-2">
            <Clock className="h-3.5 w-3.5" />
            {restaurant.estimated_delivery}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-neutral-50 px-2 py-2">
            <Bike className="h-3.5 w-3.5" />
            {money(restaurant.delivery_fee_estimate)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-neutral-50 px-2 py-2">
            <Store className="h-3.5 w-3.5" />
            {money(restaurant.min_order_amount)} min
          </span>
        </div>
      </div>
    </button>
  )
}

function MenuPanel({
  restaurant,
  onBack,
}: {
  restaurant: FigoRestaurant
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [conflictItem, setConflictItem] = useState<FigoMenuItem | null>(null)
  const { data: categories, isLoading } = useQuery({
    queryKey: ["figo", "menu", restaurant.id],
    queryFn: () => fetchFigoMenu(restaurant.id),
  })
  const addItem = useMutation({
    mutationFn: (input: { item: FigoMenuItem; clearExisting?: boolean }) =>
      addFigoCartItem(input.item.id, input.clearExisting),
    onSuccess: () => {
      setConflictItem(null)
      queryClient.invalidateQueries({ queryKey: ["figo", "cart"] })
    },
    onError: (_error, input) => {
      setConflictItem(input.item)
    },
  })

  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 p-4">
        <button onClick={onBack} className="mb-3 text-sm font-bold text-orange-700">
          Back to restaurants
        </button>
        <h2 className="text-2xl font-black">{restaurant.name}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {restaurant.cuisines.join(" - ")} - {restaurant.estimated_delivery}
        </p>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading menu
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {(categories ?? []).map((category) => (
            <div key={category.id} className="p-4">
              <h3 className="font-black">{category.name}</h3>
              <div className="mt-3 grid gap-3">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold">{item.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                        {item.description}
                      </p>
                      <p className="mt-2 text-sm font-black">
                        {money(item.discount_price || item.base_price)}
                      </p>
                    </div>
                    <button
                      disabled={!item.is_available || addItem.isPending}
                      onClick={() => addItem.mutate({ item })}
                      className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {conflictItem ? (
        <div className="border-t border-orange-200 bg-orange-50 p-4">
          <p className="font-bold text-orange-900">Start a new FiGo cart?</p>
          <p className="mt-1 text-sm text-orange-800">
            MVP supports one restaurant per cart. Clear your current cart to add
            {` ${conflictItem.name}`}.
          </p>
          <button
            onClick={() => addItem.mutate({ item: conflictItem, clearExisting: true })}
            className="mt-3 rounded-md bg-orange-700 px-4 py-2 text-sm font-bold text-white"
          >
            Clear cart and add item
          </button>
        </div>
      ) : null}
    </section>
  )
}

function CartPanel() {
  const queryClient = useQueryClient()
  const [coupon, setCoupon] = useState("FIGO50")
  const { data: cart, isLoading } = useQuery({
    queryKey: ["figo", "cart"],
    queryFn: fetchFigoCart,
    retry: false,
  })
  const couponMutation = useMutation({
    mutationFn: () => applyFigoCoupon(coupon),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "cart"] }),
  })

  return (
    <aside className="sticky top-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <ShoppingBag className="h-5 w-5 text-orange-700" />
        <h2 className="font-black">Cart</h2>
      </div>
      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading cart...</p>
      ) : !cart || cart.items.length === 0 ? (
        <p className="text-sm text-neutral-500">Add a dish to start your order.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-bold">{cart.restaurant}</p>
          <div className="space-y-2">
            {cart.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 text-sm">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="font-bold">{money(item.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(event) => setCoupon(event.target.value.toUpperCase())}
              className="min-w-0 flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            <button
              onClick={() => couponMutation.mutate()}
              disabled={couponMutation.isPending}
              className="rounded-md bg-orange-700 px-3 py-2 text-sm font-bold text-white"
            >
              Apply
            </button>
          </div>
          <div className="space-y-1 border-t border-neutral-200 pt-3 text-sm">
            <Row label="Items" value={money(cart.totals.item_subtotal)} />
            <Row label="Packaging" value={money(cart.totals.packaging_fee)} />
            <Row label="Tax" value={money(cart.totals.tax_total)} />
            <Row label="Delivery" value={money(cart.totals.delivery_fee)} />
            <Row label="Platform" value={money(cart.totals.platform_fee)} />
            {cart.totals.coupon_discount > 0 ? (
              <Row label="Coupon" value={`- ${money(cart.totals.coupon_discount)}`} />
            ) : null}
            <Row label="Total" value={money(cart.totals.final_amount)} strong />
          </div>
        </div>
      )}
    </aside>
  )
}

function CheckoutPanel() {
  const queryClient = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE" | "WALLET">("COD")
  const [paymentIntent, setPaymentIntent] = useState<Record<string, unknown> | null>(null)
  const [trackingOrderId, setTrackingOrderId] = useState<string>("")
  const [form, setForm] = useState({
    receiver_name: "",
    phone: "",
    address_line1: "",
    city: "",
    state: "",
    postal_code: "",
    latitude: "",
    longitude: "",
  })
  // Phase 2 §D4: the food UI no longer displays a wallet balance.
  // The previous code read /v1/monetization/wallet (creator-earnings
  // ledger) and rendered it as if it were a consumer balance — that
  // was a real product bug. The consumer wallet ships in wallet-service
  // in the same Phase 2 sprint; until then we show a "Wallet coming
  // soon" banner instead of any balance.
  const { data: addresses } = useQuery({
    queryKey: ["figo", "addresses"],
    queryFn: fetchFigoAddresses,
    retry: false,
  })
  const orders = useQuery({
    queryKey: ["figo", "orders"],
    queryFn: fetchFigoOrders,
    retry: false,
  })
  const tracking = useQuery({
    queryKey: ["figo", "tracking", trackingOrderId],
    queryFn: () => fetchFigoOrderTracking(trackingOrderId),
    enabled: Boolean(trackingOrderId),
    retry: false,
  })
  const checkout = useMutation({
    mutationFn: async () => {
      const existing = addresses?.[0]
      const address =
        existing ??
        (await createFigoAddress({
          ...form,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
          label: "Home",
          country: "India",
          is_default: true,
        }))
      const order = await placeFigoOrder({ address_id: address.id, payment_method: paymentMethod })
      if (paymentMethod !== "COD") {
        const intent = await createFigoPaymentIntent(order.id, paymentMethod)
        const intentPayload = (intent.payment_intent ?? { ...intent }) as Record<string, unknown>
        setPaymentIntent(intentPayload)
        if (paymentMethod === "WALLET") {
          await confirmFigoPayment(order.id, { provider_reference: String(intent.provider_order_id ?? "") })
        } else {
          const providerRef = stringField(intentPayload, "provider_ref") || intent.provider_order_id || ""
          const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
          if (key && providerRef) {
            const payment = await openRazorpayCheckout({
              key,
              order_id: providerRef,
              amount: Math.round(order.totals.final_amount * 100),
              currency: "INR",
              name: "FiGo",
              description: `Order ${order.order_number}`,
              theme: { color: "#c2410c" },
            })
            await confirmFigoPayment(order.id, {
              provider_payment_id: payment.razorpay_payment_id,
              provider_reference: payment.razorpay_order_id,
            })
          }
        }
      } else {
        setPaymentIntent(null)
      }
      setTrackingOrderId(order.id)
      return order
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["figo", "cart"] })
      queryClient.invalidateQueries({ queryKey: ["figo", "orders"] })
      queryClient.invalidateQueries({ queryKey: ["figo", "addresses"] })
    },
  })

  return (
    <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <ReceiptText className="h-5 w-5 text-orange-700" />
        <h2 className="font-black">Checkout and orders</h2>
      </div>
      {addresses && addresses.length > 0 ? (
        <div className="rounded-md bg-neutral-50 p-3 text-sm">
          <p className="font-bold">Delivering to {addresses[0].label || "saved address"}</p>
          <p className="mt-1 text-neutral-500">
            {addresses[0].address_line1}, {addresses[0].city}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {(["receiver_name", "phone", "address_line1", "city", "state", "postal_code", "latitude", "longitude"] as const).map(
            (field) => (
              <input
                key={field}
                value={form[field]}
                onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
                placeholder={field.replaceAll("_", " ")}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            ),
          )}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["COD", "ONLINE", "WALLET"] as const).map((method) => (
          <button
            key={method}
            onClick={() => setPaymentMethod(method)}
            className={`rounded-md border px-3 py-2 text-xs font-black ${
              paymentMethod === method ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white"
            }`}
          >
            {method}
          </button>
        ))}
      </div>
      {/* Phase 2 §D4: AtPost consumer wallet is shipping in the
          wallet-service in the same Phase 2 sprint. Until it lands we
          do not show any balance here, because the previous code was
          reading the creator-earnings ledger and labelling it as a
          consumer balance. */}
      <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
        <p className="font-bold">Wallet coming soon</p>
        <p className="mt-1 text-neutral-500">
          Pay COD or Online for now. The AtPost wallet launches in this Phase 2 sprint.
        </p>
      </div>
      <button
        onClick={() => checkout.mutate()}
        disabled={checkout.isPending}
        className="mt-3 w-full rounded-md bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
      >
        {checkout.isPending ? "Placing order..." : `Place ${paymentMethod} order`}
      </button>
      {checkout.data ? (
        <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-4 w-4" />
            Order {checkout.data.order_number} placed
          </p>
          {paymentIntent ? (
            <p className="mt-2 break-all text-xs">
              Payment intent: {String(paymentIntent.provider_ref ?? paymentIntent.id ?? "")}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-5 space-y-2">
        <p className="font-bold">Recent orders</p>
        {(orders.data ?? []).slice(0, 3).map((order) => (
          <div key={order.id} className="rounded-md border border-neutral-200 p-3 text-sm">
            <button onClick={() => setTrackingOrderId(order.id)} className="w-full text-left">
              <div className="flex justify-between gap-3">
                <span className="font-bold">{order.order_number}</span>
                <span>{money(order.totals.final_amount)}</span>
              </div>
              <p className="mt-1 text-neutral-500">
                {order.restaurant_name} - {order.status}
              </p>
            </button>
            {order.status === "DELIVERED" ? <RatingActions order={order} /> : null}
          </div>
        ))}
      </div>
      {tracking.data ? (
        <div className="mt-5 rounded-md border border-neutral-200 p-3 text-sm">
          <p className="font-black">Tracking {tracking.data.order_number}</p>
          <div className="mt-3 space-y-2">
            {tracking.data.timeline.map((event, index) => (
              <div key={`${event.created_at}-${index}`} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-bold">{event.label}</p>
                  <p className="text-xs text-neutral-500">{event.created_at}</p>
                </div>
              </div>
            ))}
          </div>
          <TrackingMapPanel tracking={tracking.data} />
        </div>
      ) : null}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "pt-2 text-base font-black" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function RatingActions({ order }: { order: FigoOrder }) {
  const queryClient = useQueryClient()
  const [done, setDone] = useState(false)
  const rating = useMutation({
    mutationFn: async (score: number) => {
      await Promise.all([
        rateFigoRestaurant(order.id, score),
        rateFigoDelivery(order.id, score),
      ])
    },
    onSuccess: () => {
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ["figo", "orders"] })
    },
  })
  if (done) {
    return <p className="mt-3 text-xs font-bold text-emerald-700">Rated</p>
  }
  return (
    <div className="mt-3 flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          onClick={() => rating.mutate(score)}
          disabled={rating.isPending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-orange-700 disabled:opacity-50"
          aria-label={`Rate ${score}`}
        >
          <Star className="h-4 w-4 fill-orange-600" />
        </button>
      ))}
    </div>
  )
}

function CoordCard({ label, point }: { label: string; point?: FigoLocationPoint }) {
  return (
    <div className="rounded-md bg-neutral-50 p-2">
      <p className="text-xs font-bold text-neutral-700">{label}</p>
      {point ? (
        <>
          <p className="mt-1 font-mono text-[11px] text-neutral-950">
            {point.latitude?.toFixed?.(5) ?? point.latitude}, {point.longitude?.toFixed?.(5) ?? point.longitude}
          </p>
          {point.recorded_at ? <p className="mt-1 text-[11px] text-neutral-500">{point.recorded_at}</p> : null}
        </>
      ) : (
        <p className="mt-1 text-xs text-neutral-400">Pending</p>
      )}
    </div>
  )
}

function TrackingMapPanel({ tracking }: { tracking: FigoOrderTracking }) {
  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-white p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-black">
          <MapPin className="h-3.5 w-3.5 text-orange-700" />
          Map
        </span>
        {tracking.estimated_delivery_minutes ? <span>{tracking.estimated_delivery_minutes} min ETA</span> : null}
      </div>
      <div className="grid gap-2">
        <CoordCard label="Restaurant" point={tracking.restaurant_location} />
        <CoordCard label="Rider" point={tracking.delivery_location} />
        <CoordCard label="Customer" point={tracking.customer_location} />
      </div>
    </div>
  )
}

type FigoRole = "customer" | "partner" | "delivery" | "admin"

function RoleTabs({ value, onChange }: { value: FigoRole; onChange: (role: FigoRole) => void }) {
  const tabs: Array<{ role: FigoRole; label: string; icon: typeof ShoppingBag }> = [
    { role: "customer", label: "Customer", icon: ShoppingBag },
    { role: "partner", label: "Partner", icon: Store },
    { role: "delivery", label: "Delivery", icon: Truck },
    { role: "admin", label: "Admin", icon: ShieldCheck },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 py-4 md:px-6">
      <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-2 md:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.role}
              onClick={() => onChange(tab.role)}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-black transition ${
                value === tab.role ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PartnerOpsPanel() {
  const queryClient = useQueryClient()
  const [restaurantForm, setRestaurantForm] = useState({
    name: "FiGo Kitchen",
    legal_name: "FiGo Kitchen",
    phone: "9999999999",
    email: "kitchen@figo.local",
    address_line1: "Market road",
    city: "Bengaluru",
    state: "Karnataka",
    min_order_amount: 149,
    packaging_fee: 12,
  })
  const [categoryName, setCategoryName] = useState("Meals")
  const [categoryId, setCategoryId] = useState("")
  const [itemForm, setItemForm] = useState({
    name: "FiGo thali",
    base_price: 179,
    food_type: "VEG",
    preparation_minutes: 20,
  })
  const restaurants = useQuery({
    queryKey: ["figo", "partner", "restaurants"],
    queryFn: fetchFigoPartnerRestaurants,
    retry: false,
  })
  const selected = restaurants.data?.[0]
  const menu = useQuery({
    queryKey: ["figo", "menu", selected?.id],
    queryFn: () => fetchFigoMenu(selected!.id),
    enabled: Boolean(selected?.id),
  })
  const orders = useQuery({
    queryKey: ["figo", "partner", "orders", selected?.id],
    queryFn: () => fetchFigoPartnerOrders(selected!.id),
    enabled: Boolean(selected?.id),
    retry: false,
  })
  const summary = useQuery({
    queryKey: ["figo", "partner", "summary", selected?.id],
    queryFn: () => fetchFigoPartnerSummary(selected!.id),
    enabled: Boolean(selected?.id),
    retry: false,
  })
  const settlements = useQuery({
    queryKey: ["figo", "partner", "settlements", selected?.id],
    queryFn: () => fetchFigoPartnerSettlements(selected!.id),
    enabled: Boolean(selected?.id),
    retry: false,
  })
  const createRestaurant = useMutation({
    mutationFn: () => createFigoPartnerRestaurant(restaurantForm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "partner"] }),
  })
  const createCategory = useMutation({
    mutationFn: () => createFigoMenuCategory(selected!.id, { name: categoryName }),
    onSuccess: (category) => {
      setCategoryId(category.id)
      queryClient.invalidateQueries({ queryKey: ["figo", "menu", selected?.id] })
    },
  })
  const createItem = useMutation({
    mutationFn: () =>
      createFigoMenuItem(selected!.id, {
        ...itemForm,
        category_id: categoryId || menu.data?.[0]?.id || "",
        tax_percentage: 5,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "menu", selected?.id] }),
  })
  const updateOrder = useMutation({
    mutationFn: (input: { id: string; action: "accept" | "reject" | "mark-ready" }) =>
      updateFigoPartnerOrder(input.id, input.action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "partner", "orders", selected?.id] }),
  })

  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-[0.9fr_1.1fr] md:px-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-orange-700" />
          <h2 className="font-black">Restaurant partner</h2>
        </div>
        <div className="grid gap-2">
          {(["name", "legal_name", "phone", "email", "address_line1", "city", "state"] as const).map((field) => (
            <input
              key={field}
              value={restaurantForm[field]}
              onChange={(event) => setRestaurantForm((prev) => ({ ...prev, [field]: event.target.value }))}
              placeholder={field.replaceAll("_", " ")}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          ))}
          <button
            onClick={() => createRestaurant.mutate()}
            disabled={createRestaurant.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Submit restaurant
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {(restaurants.data ?? []).map((restaurant) => (
            <div key={restaurant.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-bold">{restaurant.name}</span>
                <span className="font-bold text-orange-700">{restaurant.status}</span>
              </div>
              <p className="mt-1 text-neutral-500">{restaurant.city}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-orange-700" />
          <h2 className="font-black">Menu and orders</h2>
        </div>
        {selected ? (
          <div className="grid gap-4">
            {summary.data ? (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Metric label="Orders" value={String(summary.data.orders ?? 0)} />
                <Metric label="Gross" value={money(Number(summary.data.gross_amount ?? 0))} />
                <Metric label="Payout" value={money(Number(summary.data.payout_amount ?? 0))} />
              </div>
            ) : null}
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
              <button onClick={() => createCategory.mutate()} className="rounded-md bg-orange-700 px-4 py-2 text-sm font-bold text-white">
                Add category
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={itemForm.name}
                onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
              <input
                type="number"
                value={itemForm.base_price}
                onChange={(event) => setItemForm((prev) => ({ ...prev, base_price: Number(event.target.value) }))}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
              <button
                onClick={() => createItem.mutate()}
                disabled={!categoryId && !menu.data?.[0]?.id}
                className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Add dish
              </button>
            </div>
            <OrderActionList
              orders={orders.data ?? []}
              actions={[
                { label: "Accept", action: "accept" },
                { label: "Ready", action: "mark-ready" },
                { label: "Reject", action: "reject" },
              ]}
              onAction={(order, action) => updateOrder.mutate({ id: order.id, action: action as "accept" | "reject" | "mark-ready" })}
            />
            <div className="border-t border-neutral-200 pt-4">
              <h3 className="mb-3 font-black">Settlements</h3>
              <div className="grid gap-2">
                {(settlements.data ?? []).slice(0, 4).map((item) => (
                  <div key={item.id} className="flex justify-between rounded-md bg-neutral-50 p-3 text-sm">
                    <span className="font-bold">{item.status}</span>
                    <span>{money(item.payout_amount)}</span>
                  </div>
                ))}
                {settlements.data?.length === 0 ? <p className="text-sm text-neutral-500">No settlements yet.</p> : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Submit a restaurant before adding menu items.</p>
        )}
      </div>
    </section>
  )
}

function DeliveryOpsPanel() {
  const queryClient = useQueryClient()
  const [locationMessage, setLocationMessage] = useState("")
  const [form, setForm] = useState({
    full_name: "FiGo Rider",
    phone: "9999999999",
    vehicle_type: "BIKE",
    vehicle_number: "KA01FIGO",
    city: "Bengaluru",
  })
  const profile = useQuery({
    queryKey: ["figo", "delivery", "profile"],
    queryFn: fetchFigoDeliveryPartner,
    retry: false,
  })
  const assignments = useQuery({
    queryKey: ["figo", "delivery", "assignments"],
    queryFn: fetchFigoDeliveryAssignments,
    retry: false,
  })
  const currentAssignment = useQuery({
    queryKey: ["figo", "delivery", "current"],
    queryFn: fetchFigoCurrentDeliveryAssignment,
    retry: false,
  })
  const assignmentTracking = useQuery({
    queryKey: ["figo", "delivery", "tracking", currentAssignment.data?.id],
    queryFn: () => fetchFigoAssignmentTracking(currentAssignment.data!.id),
    enabled: Boolean(currentAssignment.data?.id),
    retry: false,
  })
  const earnings = useQuery({
    queryKey: ["figo", "delivery", "earnings"],
    queryFn: fetchFigoDeliveryEarnings,
    retry: false,
  })
  const history = useQuery({
    queryKey: ["figo", "delivery", "history"],
    queryFn: fetchFigoDeliveryHistory,
    retry: false,
  })
  const saveProfile = useMutation({
    mutationFn: () => upsertFigoDeliveryPartner(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "delivery"] }),
  })
  const toggleOnline = useMutation({
    mutationFn: () => setFigoDeliveryAvailability(!profile.data?.is_online),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "delivery"] }),
  })
  const updateAssignment = useMutation({
    mutationFn: (input: { id: string; action: "accept" | "reject" | "arrived-restaurant" | "picked-up" | "arrived-customer" | "delivered" }) =>
      updateFigoDeliveryAssignment(input.id, input.action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "delivery"] }),
  })
  const updateLocation = useMutation({
    mutationFn: () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        if (!("geolocation" in navigator)) {
          reject(new Error("Browser location unavailable"))
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const result = await updateFigoDeliveryLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy_meters: position.coords.accuracy,
              })
              resolve(result)
            } catch (error) {
              reject(error)
            }
          },
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 10_000 },
        )
      }),
    onSuccess: () => {
      setLocationMessage("Location updated")
      queryClient.invalidateQueries({ queryKey: ["figo", "delivery"] })
    },
    onError: (error) => setLocationMessage(error instanceof Error ? error.message : "Location update failed"),
  })

  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-[0.8fr_1.2fr] md:px-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-orange-700" />
          <h2 className="font-black">Delivery partner</h2>
        </div>
        <div className="grid gap-2">
          {(["full_name", "phone", "vehicle_type", "vehicle_number", "city"] as const).map((field) => (
            <input
              key={field}
              value={form[field]}
              onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
              placeholder={field.replaceAll("_", " ")}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
          ))}
          <button onClick={() => saveProfile.mutate()} className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-black text-white">
            Save profile
          </button>
          {profile.data ? (
            <button
              onClick={() => toggleOnline.mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-700 px-4 py-3 text-sm font-black text-white"
            >
              <Power className="h-4 w-4" />
              {profile.data.is_online ? "Go offline" : "Go online"}
            </button>
          ) : null}
          {profile.data ? (
            <button
              onClick={() => updateLocation.mutate()}
              disabled={updateLocation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-200 px-4 py-3 text-sm font-black text-neutral-900 disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              {updateLocation.isPending ? "Updating..." : "Update location"}
            </button>
          ) : null}
        </div>
        {locationMessage ? <p className="mt-3 text-sm font-bold text-orange-700">{locationMessage}</p> : null}
        {profile.data ? (
          <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm">
            <p className="font-bold">{profile.data.full_name}</p>
            <p className="mt-1 text-neutral-500">
              {profile.data.status} - {profile.data.is_online ? "Online" : "Offline"}
            </p>
          </div>
        ) : null}
        {earnings.data ? (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Today" value={money(earnings.data.earnings_today)} />
            <Metric label="Trips" value={earnings.data.deliveries_today} />
            <Metric label="All earnings" value={money(earnings.data.total_earnings)} />
            <Metric label="All trips" value={earnings.data.total_deliveries} />
          </div>
        ) : null}
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-black">Delivery assignments</h2>
        {currentAssignment.data ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-black">Current: {currentAssignment.data.order_number}</p>
            <p className="mt-1">{currentAssignment.data.restaurant_name} - {currentAssignment.data.status}</p>
            {assignmentTracking.data?.delivery_location ? (
              <div className="mt-3">
                <CoordCard label="Latest GPS" point={assignmentTracking.data.delivery_location} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3">
          {(assignments.data ?? []).map((assignment) => (
            <div key={assignment.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-bold">{assignment.order_number}</span>
                <span>{assignment.status}</span>
              </div>
              <p className="mt-1 text-neutral-500">{assignment.restaurant_name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["accept", "arrived-restaurant", "picked-up", "arrived-customer", "delivered", "reject"] as const).map((action) => (
                  <button
                    key={action}
                    onClick={() => updateAssignment.mutate({ id: assignment.id, action })}
                    className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-800"
                  >
                    {action.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {assignments.data?.length === 0 ? <p className="text-sm text-neutral-500">No assignments available.</p> : null}
        </div>
        {history.data && history.data.length > 0 ? (
          <div className="mt-5 border-t border-neutral-200 pt-4">
            <h3 className="mb-3 font-black">Recent delivery history</h3>
            <div className="grid gap-2">
              {history.data.slice(0, 3).map((assignment) => (
                <div key={assignment.id} className="flex justify-between rounded-md bg-neutral-50 p-3 text-sm">
                  <span className="font-bold">{assignment.order_number}</span>
                  <span>{money(assignment.delivery_partner_payout)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AdminOpsPanel() {
  const queryClient = useQueryClient()
  const [coupon, setCoupon] = useState({
    code: "FIGO75",
    title: "FiGo admin offer",
    coupon_type: "FLAT" as const,
    discount_value: 75,
    max_discount_amount: 75,
    min_order_amount: 249,
  })
  const [serviceArea, setServiceArea] = useState({
    name: "Central Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    radius_km: 8,
  })
  const [settlementRange, setSettlementRange] = useState({
    period_start: todayISO(-7),
    period_end: todayISO(),
  })
  const dashboard = useQuery({ queryKey: ["figo", "admin", "dashboard"], queryFn: fetchFigoAdminDashboard, retry: false })
  const restaurants = useQuery({ queryKey: ["figo", "admin", "restaurants"], queryFn: fetchFigoAdminPendingRestaurants, retry: false })
  const partners = useQuery({ queryKey: ["figo", "admin", "delivery-partners"], queryFn: fetchFigoAdminPendingDeliveryPartners, retry: false })
  const orders = useQuery({ queryKey: ["figo", "admin", "orders"], queryFn: fetchFigoAdminOrders, retry: false })
  const coupons = useQuery({ queryKey: ["figo", "admin", "coupons"], queryFn: fetchFigoAdminCoupons, retry: false })
  const serviceAreas = useQuery({ queryKey: ["figo", "admin", "service-areas"], queryFn: fetchFigoServiceAreas, retry: false })
  const revenue = useQuery({ queryKey: ["figo", "admin", "revenue"], queryFn: fetchFigoRevenueReport, retry: false })
  const restaurantSettlements = useQuery({ queryKey: ["figo", "admin", "restaurant-settlements"], queryFn: fetchFigoAdminRestaurantSettlements, retry: false })
  const deliverySettlements = useQuery({ queryKey: ["figo", "admin", "delivery-settlements"], queryFn: fetchFigoAdminDeliverySettlements, retry: false })
  const auditLogs = useQuery({ queryKey: ["figo", "admin", "audit-logs"], queryFn: fetchFigoAdminAuditLogs, retry: false })
  const reviewRestaurant = useMutation({
    mutationFn: (input: { id: string; approve: boolean }) => reviewFigoAdminRestaurant(input.id, input.approve),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin"] }),
  })
  const reviewPartner = useMutation({
    mutationFn: (input: { id: string; approve: boolean }) => reviewFigoAdminDeliveryPartner(input.id, input.approve),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin"] }),
  })
  const createCoupon = useMutation({
    mutationFn: () => createFigoAdminCoupon(coupon),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin", "coupons"] }),
  })
  const createServiceArea = useMutation({
    mutationFn: () => createFigoServiceArea(serviceArea),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin", "service-areas"] }),
  })
  const cancelOrder = useMutation({
    mutationFn: (orderId: string) => cancelFigoAdminOrder(orderId, "Cancelled by admin"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin", "orders"] }),
  })
  const refundOrder = useMutation({
    mutationFn: (order: FigoOrder) => refundFigoAdminOrder(order.id, "Admin refund", order.totals.final_amount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin", "orders"] }),
  })
  const generateSettlements = useMutation({
    mutationFn: () => generateFigoAdminSettlements(settlementRange),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["figo", "admin", "restaurant-settlements"] })
      queryClient.invalidateQueries({ queryKey: ["figo", "admin", "delivery-settlements"] })
      queryClient.invalidateQueries({ queryKey: ["figo", "admin", "audit-logs"] })
    },
  })
  const markRestaurantPaid = useMutation({
    mutationFn: (settlementId: string) => markFigoAdminRestaurantSettlementPaid(settlementId, `FIGO-${Date.now()}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin", "restaurant-settlements"] }),
  })
  const markDeliveryPaid = useMutation({
    mutationFn: (settlementId: string) => markFigoAdminDeliverySettlementPaid(settlementId, `FIGO-${Date.now()}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["figo", "admin", "delivery-settlements"] }),
  })

  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-[0.85fr_1.15fr] md:px-6">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-700" />
            <h2 className="font-black">Admin console</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Orders" value={dashboard.data?.total_orders_today ?? 0} />
            <Metric label="GMV" value={money(dashboard.data?.gmv_today)} />
            <Metric label="Restaurants" value={dashboard.data?.active_restaurants ?? 0} />
            <Metric label="Riders online" value={dashboard.data?.online_delivery_partners ?? 0} />
            <Metric label="Commission" value={money(revenue.data?.commission)} />
            <Metric label="Net revenue" value={money(revenue.data?.net_revenue)} />
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Create coupon</h3>
          <div className="grid gap-2">
            <input value={coupon.code} onChange={(event) => setCoupon((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500" />
            <input value={coupon.title} onChange={(event) => setCoupon((prev) => ({ ...prev, title: event.target.value }))} className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500" />
            <button onClick={() => createCoupon.mutate()} className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-black text-white">
              Create coupon
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Service areas</h3>
          <div className="grid gap-2">
            {(["name", "city", "state"] as const).map((field) => (
              <input
                key={field}
                value={serviceArea[field]}
                onChange={(event) => setServiceArea((prev) => ({ ...prev, [field]: event.target.value }))}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            ))}
            <input
              type="number"
              value={serviceArea.radius_km}
              onChange={(event) => setServiceArea((prev) => ({ ...prev, radius_km: Number(event.target.value) }))}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            <button onClick={() => createServiceArea.mutate()} className="rounded-md bg-orange-700 px-4 py-3 text-sm font-black text-white">
              Add service area
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {(serviceAreas.data ?? []).slice(0, 3).map((area) => (
              <div key={area.id} className="flex justify-between rounded-md bg-neutral-50 p-3 text-sm">
                <span className="font-bold">{area.name}</span>
                <span>{area.city}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Generate settlements</h3>
          <div className="grid gap-2">
            <input
              type="date"
              value={settlementRange.period_start}
              onChange={(event) => setSettlementRange((prev) => ({ ...prev, period_start: event.target.value }))}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            <input
              type="date"
              value={settlementRange.period_end}
              onChange={(event) => setSettlementRange((prev) => ({ ...prev, period_end: event.target.value }))}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            <button
              onClick={() => generateSettlements.mutate()}
              disabled={generateSettlements.isPending}
              className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {generateSettlements.isPending ? "Generating..." : "Generate"}
            </button>
          </div>
          {generateSettlements.data ? (
            <p className="mt-3 text-sm font-bold text-emerald-700">
              {generateSettlements.data.restaurant_settlements.length} restaurant, {generateSettlements.data.delivery_settlements.length} delivery
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">
        <ApprovalList
          title="Pending restaurants"
          items={restaurants.data ?? []}
          onApprove={(item) => reviewRestaurant.mutate({ id: item.id, approve: true })}
          onReject={(item) => reviewRestaurant.mutate({ id: item.id, approve: false })}
        />
        <ApprovalList
          title="Pending riders"
          items={partners.data ?? []}
          onApprove={(item) => reviewPartner.mutate({ id: item.id, approve: true })}
          onReject={(item) => reviewPartner.mutate({ id: item.id, approve: false })}
        />
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Live orders</h3>
          <OrderActionList
            orders={(orders.data ?? []).slice(0, 5)}
            actions={[
              { label: "Cancel", action: "cancel" },
              { label: "Refund", action: "refund" },
            ]}
            onAction={(order, action) => {
              if (action === "cancel") cancelOrder.mutate(order.id)
              if (action === "refund") refundOrder.mutate(order)
            }}
          />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Coupons</h3>
          <div className="grid gap-2">
            {(coupons.data ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="flex justify-between rounded-md bg-neutral-50 p-3 text-sm">
                <span className="font-bold">{item.code}</span>
                <span>{money(item.discount_value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Restaurant settlements</h3>
          <div className="grid gap-2">
            {(restaurantSettlements.data ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-bold">{item.restaurant_name ?? item.restaurant_id}</span>
                  <span>{money(item.payout_amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-neutral-500">{item.status}</span>
                  {item.status !== "PAID" ? (
                    <button onClick={() => markRestaurantPaid.mutate(item.id)} className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-bold">
                      Mark paid
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {restaurantSettlements.data?.length === 0 ? <p className="text-sm text-neutral-500">No restaurant settlements.</p> : null}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Delivery settlements</h3>
          <div className="grid gap-2">
            {(deliverySettlements.data ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-bold">{item.delivery_partner_name ?? item.delivery_partner_id}</span>
                  <span>{money(item.payout_amount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-neutral-500">{item.status}</span>
                  {item.status !== "PAID" ? (
                    <button onClick={() => markDeliveryPaid.mutate(item.id)} className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-bold">
                      Mark paid
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {deliverySettlements.data?.length === 0 ? <p className="text-sm text-neutral-500">No delivery settlements.</p> : null}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 font-black">Audit logs</h3>
          <div className="grid gap-2">
            {(auditLogs.data ?? []).slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-md bg-neutral-50 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-bold">{item.action}</span>
                  <span>{item.entity_type}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{item.created_at}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  )
}

function ApprovalList<T extends { id: string; name?: string; full_name?: string; status: string }>({
  title,
  items,
  onApprove,
  onReject,
}: {
  title: string
  items: T[]
  onApprove: (item: T) => void
  onReject: (item: T) => void
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 font-black">{title}</h3>
      <div className="grid gap-2">
        {items.length === 0 ? <p className="text-sm text-neutral-500">Nothing pending.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-neutral-200 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-bold">{item.name ?? item.full_name}</span>
              <span>{item.status}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onApprove(item)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
              <button onClick={() => onReject(item)} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-bold text-white">
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderActionList({
  orders,
  actions,
  onAction,
}: {
  orders: FigoOrder[]
  actions: Array<{ label: string; action: string }>
  onAction: (order: FigoOrder, action: string) => void
}) {
  return (
    <div className="grid gap-2">
      {orders.length === 0 ? <p className="text-sm text-neutral-500">No orders yet.</p> : null}
      {orders.map((order) => (
        <div key={order.id} className="rounded-md border border-neutral-200 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="font-bold">{order.order_number}</span>
            <span>{money(order.totals.final_amount)}</span>
          </div>
          <p className="mt-1 text-neutral-500">
            {order.restaurant_name} - {order.status}
          </p>
          {actions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((item) => (
                <button key={item.action} onClick={() => onAction(order, item.action)} className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-bold">
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-white">
          <div className="h-36 rounded-t-lg bg-neutral-100" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded bg-neutral-100" />
            <div className="h-3 w-full rounded bg-neutral-100" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-9 rounded bg-neutral-100" />
              <div className="h-9 rounded bg-neutral-100" />
              <div className="h-9 rounded bg-neutral-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FigoHomePage() {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState<FigoRole>("customer")
  const [selectedRestaurant, setSelectedRestaurant] = useState<FigoRestaurant | null>(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["figo", "home"],
    queryFn: () => fetchFigoHome(),
    staleTime: 60_000,
  })

  const restaurants = useMemo(() => {
    const items = data?.nearby_restaurants ?? []
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((restaurant) => {
      return (
        restaurant.name.toLowerCase().includes(normalized) ||
        restaurant.cuisines.some((cuisine) => cuisine.toLowerCase().includes(normalized))
      )
    })
  }, [data, query])

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-neutral-950">
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-10">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-800">
              <UtensilsCrossed className="h-4 w-4" />
              FiGo - Food in GO
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-normal md:text-6xl">
              Order food inside AtPost.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600">
              Browse live restaurants, add dishes to a one-restaurant cart, apply
              launch coupons, and place COD orders through the new FiGo service.
            </p>
            <div className="mt-7 flex max-w-xl items-center gap-2 rounded-lg border border-neutral-200 bg-[#f7f4ef] px-3 py-3">
              <Search className="h-5 w-5 text-neutral-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search biryani, dosa, cuisine"
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-neutral-400"
              />
            </div>
          </div>
          <div className="relative min-h-72 overflow-hidden rounded-lg bg-neutral-950">
            <img
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80"
              alt="FiGo food spread"
              className="h-full w-full object-cover opacity-90"
            />
            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-white/95 p-4 shadow-lg">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="font-black">{data?.nearby_restaurants.length ?? 0}</p>
                  <p className="text-neutral-500">Live stores</p>
                </div>
                <div>
                  <p className="font-black">FIGO50</p>
                  <p className="text-neutral-500">Launch offer</p>
                </div>
                <div>
                  <p className="font-black">COD</p>
                  <p className="text-neutral-500">MVP payment</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <MapPin className="mb-3 h-5 w-5 text-orange-700" />
            <p className="font-bold">Location-aware browse</p>
            <p className="mt-1 text-sm text-neutral-500">City and service area filters are part of the API contract.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <TicketPercent className="mb-3 h-5 w-5 text-orange-700" />
            <p className="font-bold">Server-side totals</p>
            <p className="mt-1 text-sm text-neutral-500">Coupon, tax, delivery, and platform fees come from food-service.</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-orange-700" />
            <p className="font-bold">Order snapshots</p>
            <p className="mt-1 text-sm text-neutral-500">Orders persist item, address, restaurant, and commission snapshots.</p>
          </div>
        </div>
      </section>

      <RoleTabs value={role} onChange={setRole} />

      {role === "customer" ? (
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-[1fr_360px] md:px-6">
          <div>
            {selectedRestaurant ? (
              <MenuPanel restaurant={selectedRestaurant} onBack={() => setSelectedRestaurant(null)} />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black">Nearby restaurants</h2>
                    <p className="text-sm text-neutral-500">Seed data comes from the new FiGo food-service schema.</p>
                  </div>
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                </div>
                {isLoading ? <LoadingState /> : null}
                {isError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
                    <p className="font-bold">FiGo could not load.</p>
                    <p className="mt-1 text-sm">Check that food-service is running and proxied through the API gateway.</p>
                    <button onClick={() => refetch()} className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white">
                      Retry
                    </button>
                  </div>
                ) : null}
                {!isLoading && !isError && restaurants.length === 0 ? (
                  <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center">
                    <p className="font-bold">No restaurants match this search.</p>
                    <p className="mt-1 text-sm text-neutral-500">Try a cuisine or restaurant name from the FiGo launch catalog.</p>
                  </div>
                ) : null}
                {!isLoading && !isError && restaurants.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {restaurants.map((restaurant) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        onOpen={() => setSelectedRestaurant(restaurant)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div>
            <CartPanel />
            <CheckoutPanel />
          </div>
        </section>
      ) : null}
      {role === "partner" ? <PartnerOpsPanel /> : null}
      {role === "delivery" ? <DeliveryOpsPanel /> : null}
      {role === "admin" ? <AdminOpsPanel /> : null}
    </main>
  )
}
