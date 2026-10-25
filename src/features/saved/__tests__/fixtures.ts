/*
  Wire fixtures for saved collections, written from the Go handlers of
  post-service (server commit 546eec063). Each cites where its shape comes
  from, under Architecture/services/post-service/internal/.

  Envelope: shared/api/response.go:12-16 — { data, error, meta }, meta
  carrying next_cursor (response.go:26-28).
*/

export const COLLECTION_RECIPES = "11111111-1111-4111-8111-111111111111"
export const COLLECTION_TRIPS = "22222222-2222-4222-8222-222222222222"
export const SAVED_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
export const SAVED_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
export const POST_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
export const POST_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

/*
  GET /v1/saved/collections — http/saved_collections_handler.go:22-25: the
  default first ({id:null, name:"All Saved", count, is_default:true};
  service/saved_collections.go:134), then the caller's, oldest first
  (store/postgres/saved_collections.go:96). SavedCollection is
  service/saved_collections.go:82-90: created_at / updated_at omitempty, so
  the default row has neither. The default's count is the items in NO named
  collection (store/postgres/saved_collections.go:86-87).
*/
export const listCollections200 = {
  data: [
    { id: null, name: "All Saved", count: 3, is_default: true },
    {
      id: COLLECTION_RECIPES,
      name: "Recipes",
      count: 2,
      is_default: false,
      created_at: "2026-10-24T09:00:00Z",
      updated_at: "2026-10-24T09:00:00Z",
    },
    {
      id: COLLECTION_TRIPS,
      name: "Trips",
      count: 0,
      is_default: false,
      created_at: "2026-10-24T10:00:00Z",
      updated_at: "2026-10-24T10:00:00Z",
    },
  ],
}

/* POST /v1/saved/collections {name} — saved_collections_handler.go:26-27, 184-200: 201 data: collection. */
export const createCollection201 = {
  data: {
    id: COLLECTION_TRIPS,
    name: "Trips",
    count: 0,
    is_default: false,
    created_at: "2026-10-24T10:00:00Z",
    updated_at: "2026-10-24T10:00:00Z",
  },
}

/* DELETE /v1/saved/collections/:id — saved_collections_handler.go:30-31, 249. */
export const deleteCollection200 = {
  data: { deleted: true, collection_id: COLLECTION_RECIPES, moved_to_default: 2 },
}

/*
  A saved item — store/postgres/saved.go:17-27; collection_id null is the
  default collection. GET /v1/saved?collection_id= is handler.go:2503-2543
  ({ data: SavedItem[], meta.next_cursor }); PUT /v1/saved/:savedId/collection
  answers one item (saved_collections_handler.go:32-33, 253-274).
*/
export const savedItemInRecipes = {
  id: SAVED_A,
  user_id: "99999999-9999-4999-8999-999999999999",
  target_type: "post",
  target_id: POST_A,
  collection_name: "Recipes",
  collection_id: COLLECTION_RECIPES,
  created_at: "2026-10-24T11:00:00Z",
}

export const savedItemInDefault = {
  id: SAVED_B,
  user_id: "99999999-9999-4999-8999-999999999999",
  target_type: "post",
  target_id: POST_B,
  collection_name: "All Saved",
  collection_id: null,
  created_at: "2026-10-24T12:00:00Z",
}

export const listSavedItems200 = {
  data: [savedItemInRecipes, savedItemInDefault],
  meta: { next_cursor: "2026-10-24T11:00:00Z|aaaa" },
}

export const moveSavedItem200 = { data: { ...savedItemInDefault, collection_id: COLLECTION_RECIPES, collection_name: "Recipes" } }

/* Errors — writeSavedCollectionError, saved_collections_handler.go:63-85 (shared/api error envelope). */
function apiError(status: number, code: string, message: string) {
  return { isAxiosError: true, response: { status, data: { error: { code, message } } } }
}
export const errInvalidName = apiError(400, "INVALID_COLLECTION_NAME", "collection name must be 1-40 characters and not a reserved name")
export const errNameTaken = apiError(409, "COLLECTION_NAME_TAKEN", "You already have a collection with this name")
export const errLimit = apiError(409, "COLLECTION_LIMIT_REACHED", "You can have at most 50 collections")
export const errNotFound = apiError(404, "COLLECTION_NOT_FOUND", "Collection not found")
export const errNotSaved = apiError(404, "NOT_SAVED", "This is not in your saved items")
export const errStore = apiError(503, "STORE_UNAVAILABLE", "Saved items are unavailable right now")
export const errInternal = apiError(500, "INTERNAL_ERROR", "Internal server error")
export const errOffline = { isAxiosError: true, message: "Network Error" }
