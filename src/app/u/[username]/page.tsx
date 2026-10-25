import type { Metadata } from "next";

import { profilePageMetadata } from "@/features/share/routeMetadata";

import { UserProfileRoute } from "./UserProfileRoute";

type Props = { params: Promise<{ username: string }> };

/*
  /u/<username> — somebody's public profile, the address Share profile
  hands out (web and Android). /u/ is a PUBLIC prefix in the middleware, so
  the page resolves signed out; the chrome is decided in UserProfileRoute.

  The link preview comes from GET /v1/profiles/by-username/:handle read
  signed out: name, handle, bio and avatar. A private account's card names
  it and nothing else; an account a stranger may not see (404) gets the
  neutral card.
*/
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return profilePageMetadata(username);
}

export default function UserProfilePage() {
  return <UserProfileRoute />;
}
