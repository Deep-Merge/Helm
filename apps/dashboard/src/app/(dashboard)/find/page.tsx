import { Suspense } from "react";
import { LockViewportScroll } from "@/components/lock-viewport-scroll";
import { FindPageClient, FindPageSkeleton } from "./find-page-client";

export default function FindPage() {
  return (
    <>
      <LockViewportScroll />
      <Suspense fallback={<FindPageSkeleton />}>
        <FindPageClient />
      </Suspense>
    </>
  );
}
