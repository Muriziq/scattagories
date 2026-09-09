"use client";

import React from "react";
import { SocketProvider } from "./SocketContext";

export default function WaitingRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SocketProvider>{children}</SocketProvider>;
}
