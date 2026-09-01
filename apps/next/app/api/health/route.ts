import { withErrorHandling } from "@/lib/http";

export const dynamic = "force-dynamic";

// main.py:health の移植
export const GET = withErrorHandling(async () => {
	return Response.json({ status: "ok" });
});
