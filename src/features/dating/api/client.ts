/*
  The one place dating talks to the network. Relative `/v1/dating/...` URLs
  through the app's axios instance, which carries the bearer token; every
  answer is the standard envelope and the payload is `res.data.data`.
*/

import api from "@/lib/api"

export const BASE = "/v1/dating"

export async function get<T = unknown>(path: string, params?: Record<string, string | number>): Promise<T> {
  const res = await api.get(`${BASE}${path}`, params ? { params } : undefined)
  return res.data?.data as T
}

export async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await api.post(`${BASE}${path}`, body ?? {})
  return res.data?.data as T
}

export async function put<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await api.put(`${BASE}${path}`, body ?? {})
  return res.data?.data as T
}

export async function patch<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await api.patch(`${BASE}${path}`, body ?? {})
  return res.data?.data as T
}

export async function del<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await api.delete(`${BASE}${path}`, body ? { data: body } : undefined)
  return res.data?.data as T
}

/** The whole body, for the one route whose envelope carries its own meta (pulse/today). */
export async function getBody(path: string): Promise<unknown> {
  const res = await api.get(`${BASE}${path}`)
  return res.data
}

export const seg = (value: string | number) => encodeURIComponent(String(value))
