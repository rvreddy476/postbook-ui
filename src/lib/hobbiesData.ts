import type { HobbyInterestCategory } from "@/types/profile"

export const HOBBY_INTEREST_CATEGORIES: HobbyInterestCategory[] = [
    { id: "sports", label: "Sports", color: "bg-orange-100 text-orange-700 border-orange-200" },
    { id: "arts", label: "Arts", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { id: "music", label: "Music", color: "bg-pink-100 text-pink-700 border-pink-200" },
    { id: "technology", label: "Technology", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { id: "cooking", label: "Cooking", color: "bg-amber-100 text-amber-700 border-amber-200" },
    { id: "travel", label: "Travel", color: "bg-teal-100 text-teal-700 border-teal-200" },
    { id: "gaming", label: "Gaming", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    { id: "reading", label: "Reading", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    { id: "fitness", label: "Fitness", color: "bg-red-100 text-red-700 border-red-200" },
    { id: "photography", label: "Photography", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
    { id: "nature", label: "Nature", color: "bg-green-100 text-green-700 border-green-200" },
    { id: "science", label: "Science", color: "bg-violet-100 text-violet-700 border-violet-200" },
    { id: "fashion", label: "Fashion", color: "bg-rose-100 text-rose-700 border-rose-200" },
    { id: "film", label: "Film", color: "bg-slate-100 text-slate-700 border-slate-200" },
    { id: "writing", label: "Writing", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    { id: "volunteering", label: "Volunteering", color: "bg-lime-100 text-lime-700 border-lime-200" },
    { id: "diy", label: "DIY", color: "bg-stone-100 text-stone-700 border-stone-200" },
    { id: "pets", label: "Pets", color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
    { id: "languages", label: "Languages", color: "bg-sky-100 text-sky-700 border-sky-200" },
    { id: "finance", label: "Finance", color: "bg-zinc-100 text-zinc-700 border-zinc-200" },
]

export const SUGGESTED_TAGS: Record<string, string[]> = {
    sports: ["Soccer", "Basketball", "Tennis", "Swimming", "Running", "Cycling", "Hiking", "Yoga", "Martial Arts", "Skiing", "Surfing", "Cricket"],
    arts: ["Painting", "Drawing", "Sculpture", "Digital Art", "Calligraphy", "Pottery", "Origami", "Graphic Design", "Watercolor"],
    music: ["Guitar", "Piano", "Singing", "DJing", "Drums", "Violin", "Music Production", "Concert Going", "Ukulele"],
    technology: ["Programming", "Web Development", "AI & ML", "Robotics", "3D Printing", "Open Source", "Cybersecurity", "App Development"],
    cooking: ["Baking", "Grilling", "Vegetarian Cooking", "Asian Cuisine", "Italian Cooking", "Meal Prep", "Wine Tasting", "Coffee Brewing"],
    travel: ["Backpacking", "Road Trips", "Cultural Travel", "Adventure Travel", "Beach Holidays", "City Exploring", "Solo Travel"],
    gaming: ["PC Gaming", "Console Gaming", "Board Games", "Card Games", "Chess", "Puzzle Games", "VR Gaming", "Tabletop RPGs"],
    reading: ["Fiction", "Non-Fiction", "Sci-Fi", "Fantasy", "Biography", "Self-Help", "Poetry", "Comics", "Manga"],
    fitness: ["Weightlifting", "CrossFit", "Pilates", "Calisthenics", "HIIT", "Dance Fitness", "Boxing", "Rock Climbing"],
    photography: ["Portrait", "Landscape", "Street Photography", "Astrophotography", "Film Photography", "Drone Photography"],
    nature: ["Gardening", "Bird Watching", "Camping", "Fishing", "Stargazing", "Rock Collecting", "Beekeeping", "Foraging"],
    science: ["Astronomy", "Chemistry", "Physics", "Biology", "Ecology", "Archaeology", "Space Exploration"],
    fashion: ["Sewing", "Knitting", "Thrifting", "Sneaker Collecting", "Jewelry Making", "Fashion Design", "Crochet"],
    film: ["Filmmaking", "Screenwriting", "Movie Watching", "Documentary", "Animation", "Film Criticism", "Video Editing"],
    writing: ["Creative Writing", "Blogging", "Journaling", "Poetry Writing", "Storytelling", "Copywriting", "Screenwriting"],
    volunteering: ["Community Service", "Mentoring", "Environmental Cleanup", "Animal Shelter", "Teaching", "Fundraising"],
    diy: ["Woodworking", "Home Improvement", "Electronics", "Upcycling", "Leatherwork", "Candle Making", "Soap Making"],
    pets: ["Dog Training", "Cat Care", "Aquarium Keeping", "Horse Riding", "Reptile Keeping", "Bird Keeping"],
    languages: ["Spanish", "French", "Japanese", "Chinese", "German", "Korean", "Sign Language", "Arabic", "Italian"],
    finance: ["Investing", "Cryptocurrency", "Personal Finance", "Stock Trading", "Real Estate", "Budgeting"],
}

export const MAX_HOBBIES = 20
export const MAX_INTERESTS = 20
export const MAX_LABEL_LENGTH = 50

export function getCategoryColor(categoryId?: string): string {
    if (!categoryId) return "bg-slate-100 text-slate-600 border-slate-200"
    const cat = HOBBY_INTEREST_CATEGORIES.find(c => c.id === categoryId)
    return cat?.color ?? "bg-slate-100 text-slate-600 border-slate-200"
}
