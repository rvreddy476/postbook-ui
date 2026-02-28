"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAbout } from "@/hooks/useAbout"
import type { UserProfile } from "@/types/profile"
import { Briefcase, MapPin, Globe, Calendar } from "lucide-react"
import { AboutWorkCard } from "../cards/AboutWorkCard"
import { AboutEducationCard } from "../cards/AboutEducationCard"
import { AboutHobbiesCard } from "../cards/AboutHobbiesCard"
import { HobbiesInterestsSection } from "../hobbies/HobbiesInterestsSection"
import { AboutFamilyCard } from "../cards/AboutFamilyCard"
import { AboutContactCard } from "../cards/AboutContactCard"
import { AboutLifeEventsCard } from "../cards/AboutLifeEventsCard"

interface AboutTabProps {
    profile: UserProfile
}

export function AboutTab({ profile }: AboutTabProps) {
    const { data: aboutData, isLoading } = useAbout(profile.id)

    const basicItems = [
        { icon: Briefcase, label: "Profession", value: profile.profession },
        { icon: MapPin, label: "Location", value: profile.location },
        { icon: Globe, label: "Website", value: profile.website },
        {
            icon: Calendar,
            label: "Joined",
            value: profile.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                  })
                : undefined,
        },
    ].filter((item) => item.value)

    const hasAboutData = aboutData && Object.keys(aboutData).length > 0

    return (
        <div className="space-y-4">
            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {profile.bio && (
                        <p className="text-sm text-muted-foreground">{profile.bio}</p>
                    )}
                    {basicItems.length > 0 ? (
                        <div className="space-y-3">
                            {basicItems.map((item) => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div>
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="text-sm font-medium">{item.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No additional information available.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Detailed About Sections */}
            {isLoading ? (
                <Card>
                    <CardContent className="py-8">
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : hasAboutData ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <AboutWorkCard items={aboutData.work ?? []} />
                        <AboutEducationCard items={aboutData.education ?? []} />
                        <HobbiesInterestsSection userId={profile.id} />
                        <AboutContactCard items={aboutData.contact ?? []} />
                        <AboutFamilyCard items={aboutData.family ?? []} />
                        <AboutLifeEventsCard items={aboutData.life_events ?? []} />
                    </CardContent>
                </Card>
            ) : null}
        </div>
    )
}
