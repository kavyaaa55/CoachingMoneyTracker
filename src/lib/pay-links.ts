import { env } from "./env";
import { createPayLink, readPayLink } from "./pay-link";

export const payLinkFor = (instalmentId: string) =>
  createPayLink(instalmentId, Date.now(), env.SESSION_SECRET);

export const instalmentIdFromToken = (token: string) =>
  readPayLink(token, Date.now(), env.SESSION_SECRET);
