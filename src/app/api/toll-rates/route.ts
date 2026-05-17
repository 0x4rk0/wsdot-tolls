import { NextResponse } from "next/server";
import { fetchTollRates } from "@/lib/wsdot";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  const apiKey = process.env.WSDOT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "WSDOT_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const payload = await fetchTollRates(apiKey);
    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to fetch WSDOT toll rates", error);
    return NextResponse.json(
      { error: "Unable to reach WSDOT tolling service." },
      { status: 502 },
    );
  }
}
