"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type BidEntry = {
  id: string;
  bidder: string;
  price: number;
  time: string;
};

const DEFAULT_DURATION = 15;

const mockBidders = [
  "0x9cA4...74D1",
  "0x7Bf1...2a90",
  "0x2E41...9c03",
  "0x58a9...41be",
  "0x0A12...B990",
  "0xF3b2...cA77",
];

const formatTime = (seconds: number) => `0:${seconds.toString().padStart(2, "0")}`;

const formatClock = () => {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

type UseAuctionOptions = {
  startingPrice?: number;
  startingTime?: number;
  autoReset?: boolean;
  seedLastBidder?: string;
};

export function useAuction({
  startingPrice = 0.05,
  startingTime = DEFAULT_DURATION,
  autoReset = false,
  seedLastBidder,
}: UseAuctionOptions = {}) {
  const [price, setPrice] = useState(startingPrice);
  const [timeLeft, setTimeLeft] = useState(startingTime);
  const [lastBidder, setLastBidder] = useState(
    seedLastBidder ?? mockBidders[0]
  );
  const [history, setHistory] = useState<BidEntry[]>(() => [
    {
      id: "seed-1",
      bidder: seedLastBidder ?? mockBidders[0],
      price: startingPrice,
      time: formatClock(),
    },
  ]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return autoReset ? startingTime : 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoReset, startingTime]);

  const bid = () => {
    setTimeLeft(startingTime);
    const bidder = mockBidders[Math.floor(Math.random() * mockBidders.length)];
    setLastBidder(bidder);

    setPrice((prev) => {
      const nextPrice = Number((prev + 0.01).toFixed(2));
      setHistory((prevHistory) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          bidder,
          price: nextPrice,
          time: formatClock(),
        },
        ...prevHistory,
      ].slice(0, 8));
      return nextPrice;
    });
  };

  const formattedTime = useMemo(() => formatTime(timeLeft), [timeLeft]);

  return {
    price,
    timeLeft,
    formattedTime,
    lastBidder,
    history,
    bid,
  };
}
