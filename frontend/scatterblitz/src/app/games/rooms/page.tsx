"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function RoomsRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "create") {
      router.replace("/games/create");
    } else {
      router.replace("/games/join");
    }
  }, [searchParams, router]);

  return null;
}

export default function RoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsRedirect />
    </Suspense>
  );
}