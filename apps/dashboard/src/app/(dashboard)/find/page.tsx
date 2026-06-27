import { Suspense } from "react";
import { FindPageClient, FindPageSkeleton } from "./find-page-client";

export default function FindPage() {
  return (
    <Suspense fallback={<FindPageSkeleton />}>
      <FindPageClient />
    </Suspense>
  );
}
