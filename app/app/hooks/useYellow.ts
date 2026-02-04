"use client";

import { useContext } from "react";
import { YellowContext } from "../providers/YellowProvider";

export function useYellow() {
  const ctx = useContext(YellowContext);
  if (!ctx) {
    throw new Error("useYellow must be used within YellowProvider");
  }
  return ctx;
}
