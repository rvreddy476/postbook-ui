/*
  What content_type the feed composer stamps on a new post.

  A poll is a poll. Everything else the feed composer produces — plain text,
  photos, and a video attached to a feed post — is a "post". The composer
  used to send "video" whenever a file was a video, and post-service folds
  "video" into an EXPLICIT long_video, which stamped an ordinary feed post as
  a deliberate Tube upload and pushed it into the monetization pipeline. The
  author never chose that. Reels and Tube have their own flows and send their
  kinds explicitly; the feed composer never does.
*/

export type FeedContentType = 'post' | 'poll'

export interface ChooseContentTypeInput {
  showPoll: boolean
  /** Only `type` is read, so a File or a plain { type } both work. */
  files: ReadonlyArray<{ type: string }>
}

export function chooseContentType({ showPoll }: ChooseContentTypeInput): FeedContentType {
  if (showPoll) return 'poll'
  return 'post'
}
