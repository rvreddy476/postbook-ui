/*
  Kept as an import path: the channel masthead now lives in
  features/posttube/channel (the compact masthead of ChannelScreen). Only
  the two channel routes used the old hero header, and both render
  ChannelScreen now; anything that still imports ChannelHeader gets the
  same masthead.
*/
export { ChannelMasthead as ChannelHeader } from "../channel/components/ChannelMasthead";
export type { ChannelMastheadProps as ChannelHeaderProps } from "../channel/components/ChannelMasthead";
