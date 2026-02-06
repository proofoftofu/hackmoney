import { NextResponse } from "next/server";
import { createECDSAMessageSigner, type RPCData } from "@erc7824/nitrolite";

export async function POST(request: Request) {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!operatorKey) {
    return NextResponse.json(
      { error: "Operator private key not configured." },
      { status: 500 }
    );
  }

  let payload: RPCData | null = null;
  try {
    const body = (await request.json()) as { payload?: RPCData };
    payload = body.payload ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload || !Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const signer = createECDSAMessageSigner(operatorKey);
  const signature = await signer(payload);
  return NextResponse.json({ signature });
}
