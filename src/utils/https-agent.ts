import https from "node:https";
import { getCABundle } from "./ca-certs.js";

let agent: https.Agent | null = null;

export function getHttpsAgent(): https.Agent {
  if (!agent) agent = new https.Agent({ ca: getCABundle() });
  return agent;
}
