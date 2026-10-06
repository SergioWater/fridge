import { supabase } from "./supabase";

export type ParsedItem = {
  name: string;
  quantity: number;
  unit: string | null;
};

export async function parseReceiptImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
): Promise<ParsedItem[]> {
  const { data, error } = await supabase.functions.invoke("parse-receipt", {
    body: { imageBase64, mimeType },
  });

  if (error) {
    throw new Error(`Edge function error: ${error.message}`);
  }
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Unexpected response shape");
  }
  return data.items as ParsedItem[];
}
