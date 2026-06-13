import Link from "next/link"

export default function AdminCommerceIndex() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Commerce moderation</h1>
      <p className="mt-1 text-sm text-gray-600">
        Approve or reject seller onboardings and product submissions. Both queues feed off the
        commerce-service admin endpoints; the gateway enforces the moderator/admin scope.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/commerce/sellers"
          className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition"
        >
          <div className="text-base font-semibold">Seller queue</div>
          <div className="mt-1 text-sm text-gray-600">
            New onboardings awaiting KYC + storefront review.
          </div>
        </Link>

        <Link
          href="/admin/commerce/products"
          className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition"
        >
          <div className="text-base font-semibold">Product queue</div>
          <div className="mt-1 text-sm text-gray-600">
            Submitted products awaiting catalog approval.
          </div>
        </Link>
      </div>
    </div>
  )
}
