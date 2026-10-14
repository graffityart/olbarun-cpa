import { createCpaConversion } from "@/lib/cpa/conversion-service";

export async function POST(request:Request){return createCpaConversion(request);}
