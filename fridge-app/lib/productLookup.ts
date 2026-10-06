export type ProductInfo = {
  barcode: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
};

export async function lookupBarcode(barcode: string): Promise<ProductInfo> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,image_front_small_url`,
    );
    const json = await res.json();
    if (json.status !== 1 || !json.product) {
      return { barcode, name: null, brand: null, imageUrl: null };
    }
    const p = json.product;
    return {
      barcode,
      name: p.product_name ?? null,
      brand: p.brands ?? null,
      imageUrl: p.image_front_small_url ?? null,
    };
  } catch {
    return { barcode, name: null, brand: null, imageUrl: null };
  }
}
