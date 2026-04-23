'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { DashboardStats, Product } from '@/types/commerce'

export function useSellerDashboard() {
  return useQuery({
    queryKey: ['seller', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardStats }>('/v1/commerce/dashboard')
      return res.data.data
    },
  })
}

export function useMyProducts(params: { limit?: number; offset?: number } = {}) {
  const { limit = 20, offset = 0 } = params
  return useQuery({
    queryKey: ['seller', 'products', limit, offset],
    queryFn: async () => {
      // sellers/me gives the seller; then list seller products
      const sellerRes = await api.get<{ data: { id: string } }>('/v1/commerce/sellers/me')
      const sellerId = sellerRes.data.data.id
      const res = await api.get<{ data: Product[] }>(
        `/v1/commerce/sellers/${sellerId}/products?limit=${limit}&offset=${offset}`
      )
      return res.data.data ?? []
    },
  })
}

export function useSubmitProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.post(`/v1/commerce/products/${productId}/submit`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'products'] }),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      description?: string
      category_id?: string
      product_type?: string
      variants: Array<{
        sku: string
        mrp: number
        selling_price: number
        stock_qty?: number
        option_1_name?: string
        option_1_value?: string
      }>
    }) => {
      const res = await api.post<{ data: Product }>('/v1/commerce/products', payload)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'products'] }),
  })
}
