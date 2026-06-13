// Mirror of the backend's user-service/internal/pages/config.go — the 13
// canonical page types with their labels, descriptions, and required documents.
// Drives the create picker and the owner document-upload UI. Keep in sync with
// the Go config (single source of truth lives server-side; this is the client copy).

export interface PageTypeDef {
    value: string
    label: string
    description: string
    requiredDocuments: string[]
    optionalDocuments: string[]
}

export const PAGE_TYPES: PageTypeDef[] = [
    { value: 'business', label: 'Business Page', description: 'Shops, companies, restaurants, agencies, local businesses.', requiredDocuments: ['address_proof'], optionalDocuments: ['business_registration'] },
    { value: 'creator', label: 'Creator Page', description: 'Video creators, educators, artists, coaches, writers, influencers.', requiredDocuments: ['identity_proof'], optionalDocuments: [] },
    { value: 'celebrity', label: 'Celebrity Page', description: 'Actors, musicians, sports personalities, public figures.', requiredDocuments: ['identity_proof', 'official_proof'], optionalDocuments: [] },
    { value: 'foundation_ngo', label: 'Foundation / NGO Page', description: 'Charities, NGOs, social work groups, public welfare orgs.', requiredDocuments: ['ngo_registration', 'address_proof'], optionalDocuments: [] },
    { value: 'authority_government', label: 'Authority / Government Page', description: 'Government departments, public authorities, official services.', requiredDocuments: ['government_authorization', 'official_email_domain_proof'], optionalDocuments: [] },
    { value: 'institution', label: 'Institution Page', description: 'Schools, colleges, universities, coaching & training institutions.', requiredDocuments: ['institution_registration', 'address_proof'], optionalDocuments: [] },
    { value: 'community_organization', label: 'Community / Organization Page', description: 'Associations, clubs, societies, local & professional groups.', requiredDocuments: [], optionalDocuments: ['other'] },
    { value: 'media_news', label: 'Media / News Page', description: 'News outlets, journalists, magazines, publications, media networks.', requiredDocuments: ['media_publication_proof'], optionalDocuments: [] },
    { value: 'brand', label: 'Brand Page', description: 'Product brands, labels, franchises, official brand identities.', requiredDocuments: ['brand_ownership_proof'], optionalDocuments: [] },
    { value: 'professional', label: 'Professional Page', description: 'Doctors, lawyers, consultants, architects, licensed professionals.', requiredDocuments: ['identity_proof', 'professional_license'], optionalDocuments: [] },
    { value: 'marketplace_seller', label: 'Marketplace Seller Page', description: 'Sellers, merchants, handmade creators, store owners, distributors.', requiredDocuments: ['identity_proof', 'seller_address_proof'], optionalDocuments: [] },
    { value: 'food_partner', label: 'Food Partner Page', description: 'Restaurants, cloud kitchens, bakeries, tiffin centers, caterers.', requiredDocuments: ['identity_proof'], optionalDocuments: ['fssai_license'] },
    { value: 'service_provider', label: 'Service Provider Page', description: 'Electricians, plumbers, repair, cleaners, mechanics, movers.', requiredDocuments: ['identity_proof', 'service_proof'], optionalDocuments: [] },
]

export const PAGE_TYPE_BY_VALUE: Record<string, PageTypeDef> = Object.fromEntries(
    PAGE_TYPES.map((t) => [t.value, t]),
)

/** Human label for a document_type enum value. */
export function documentLabel(dt: string): string {
    return dt
        .split('_')
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join(' ')
}
