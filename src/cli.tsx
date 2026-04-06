#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import fs from "fs";
import path from "path";
import os from "os";
import { App } from "./app.js";

const LAST_URL_FILE = path.join(os.homedir(), ".datalathe", "last-url");

function loadLastUrl(): string {
  try {
    return fs.readFileSync(LAST_URL_FILE, "utf-8").trim();
  } catch {
    return "http://localhost:3000";
  }
}

export function saveLastUrl(url: string): void {
  try {
    fs.mkdirSync(path.dirname(LAST_URL_FILE), { recursive: true });
    fs.writeFileSync(LAST_URL_FILE, url);
  } catch {
    // best-effort
  }
}

const args = process.argv.slice(2);
let url = loadLastUrl();

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url" && args[i + 1]) {
    url = args[i + 1];
    i++;
  }
}

render(<App url={url} />);
