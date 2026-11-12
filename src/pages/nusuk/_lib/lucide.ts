/**
 * Lucide icons (https://lucide.dev, ISC licence) as inline SVG strings, from the lucide-static package.
 * Works in .astro markup (set:html) and in client scripts that build HTML strings.
 */
import { Activity, Gift, Ticket, Menu, X, LogIn, UserCheck, CircleHelp, ChartLine, Flag, Send, MessageSquareWarning, Quote, UsersRound, Crown, ArrowRight, ChevronDown, CircleCheck, CircleDot, Copy, Handshake, Hourglass, Inbox, Megaphone, MessageCircle, MessageSquare, PartyPopper, Play, Search, Smartphone, Sparkles, Star, Target, Trophy, Users, Zap } from 'lucide-static';

/** inner markup of a lucide-static svg string */
const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

const P = {
  activity: inner(Activity),
  users: inner(Users),
  copy: inner(Copy),
  inbox: inner(Inbox),
  target: inner(Target),
  zap: inner(Zap),
  trophy: inner(Trophy),
  star: inner(Star),
  partyPopper: inner(PartyPopper),
  circleCheck: inner(CircleCheck),
  sparkles: inner(Sparkles),
  messageCircle: inner(MessageCircle),
  hourglass: inner(Hourglass),
  smartphone: inner(Smartphone),
  megaphone: inner(Megaphone),
  handshake: inner(Handshake),
  circleDot: inner(CircleDot),
  chevronDown: inner(ChevronDown),
  search: inner(Search),
  messageSquare: inner(MessageSquare),
  play: inner(Play),
  arrowRight: inner(ArrowRight),
  gift: inner(Gift),
  menu: inner(Menu),
  x: inner(X),
  logIn: inner(LogIn),
  userCheck: inner(UserCheck),
  circleHelp: inner(CircleHelp),
  chartLine: inner(ChartLine),
  flag: inner(Flag),
  send: inner(Send),
  messageSquareWarning: inner(MessageSquareWarning),
  quote: inner(Quote),
  usersRound: inner(UsersRound),
  crown: inner(Crown),
  ticket: inner(Ticket),
};

export type IconName = keyof typeof P;

/** Inline SVG for a Lucide icon. `cls` sets the size/colour (colour follows currentColor). `fill` fills the shape (e.g. a solid play button). */
export function lucide(name: IconName, cls = 'h-5 w-5', width = 2, fill = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
