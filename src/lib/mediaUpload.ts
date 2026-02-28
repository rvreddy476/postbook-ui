import api from "@/lib/api"

interface InitUploadResponse {
    data: {
        media_id: string
        upload_url: string
        object_key: string
        expires_at: string
    }
}

interface ConfirmUploadResponse {
    data: {
        id: string
        file_type: string
        mime_type: string
        processing_status: string
    }
}

/**
 * Upload a file through the media service's 3-step flow:
 * 1. POST /v1/media/init  → get presigned upload URL
 * 2. PUT  upload_url       → upload file directly to S3/MinIO
 * 3. POST /v1/media/confirm → confirm upload complete
 *
 * Returns the media_id string.
 */
export async function uploadMedia(
    file: File,
    fileType: "image" | "video",
    mediaSubtype: "general" | "avatar" | "cover" | "gif" = "general"
): Promise<string> {
    // Step 1: Init upload
    const initRes = await api.post<InitUploadResponse>("/v1/media/init", {
        file_type: fileType,
        media_subtype: mediaSubtype,
        mime_type: file.type,
        file_size_bytes: file.size,
    })

    const { media_id, upload_url } = initRes.data.data

    // Step 2: Upload file directly to presigned S3 URL (plain fetch, no auth headers)
    const uploadRes = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
    })

    if (!uploadRes.ok) {
        throw new Error(`S3 upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
    }

    // Step 3: Confirm upload
    await api.post<ConfirmUploadResponse>("/v1/media/confirm", {
        media_id,
    })

    return media_id
}

/**
 * Update the alt text for an already-uploaded media item.
 * Calls PATCH /v1/media/:mediaId/alt-text
 */
export async function updateMediaAltText(
    mediaId: string,
    altText: string
): Promise<void> {
    await api.patch(`/v1/media/${mediaId}/alt-text`, {
        alt_text: altText,
    })
}
