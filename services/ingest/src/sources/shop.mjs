/**
 * Fonte 4: il negozio ufficiale calciofoggia1920.store.
 * E WooCommerce e la Store API e aperta in lettura, quindi si prendono i prodotti
 * veri del club con foto, prezzi e disponibilita. Nessuna scrittura, nessun carrello:
 * l'app mostra e rimanda al negozio, l'acquisto resta la.
 */
import { getJson, stripHtml } from '../util.mjs';

const BASE = 'https://www.calciofoggia1920.store/wp-json/wc/store/v1';
const TTL = 60 * 60 * 1000;

/** I prezzi arrivano in unita minori: 8500 sono 85,00 euro. */
function toEuro(value, minorUnit = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** minorUnit;
}

export async function fetchProducts() {
  const raw = await getJson(`${BASE}/products?per_page=100`, { ttl: TTL });
  return (raw || [])
    .map((p) => {
      const prices = p.prices || {};
      const minor = prices.currency_minor_unit ?? 2;
      const images = (p.images || []).map((i) => i.src).filter(Boolean);
      const category = (p.categories || []).find((c) => c.slug !== 'uncategorized') || null;
      return {
        id: `shop-${p.id}`,
        name: stripHtml(p.name),
        price: toEuro(prices.price, minor),
        regularPrice: toEuro(prices.regular_price ?? prices.price, minor),
        onSale: Boolean(p.on_sale),
        currency: 'EUR',
        image: images[0] || null,
        images,
        category: category ? stripHtml(category.name) : null,
        categorySlug: category ? category.slug : null,
        url: p.permalink,
        inStock: p.is_in_stock !== false,
        description: stripHtml(p.short_description || p.description).slice(0, 320),
        source: 'shop',
      };
    })
    // i prodotti senza prezzo sono voci incomplete del catalogo, non offerte
    .filter((p) => p.name && p.price > 0)
    .sort((a, b) => b.price - a.price);
}

export async function fetchCategories() {
  const raw = await getJson(`${BASE}/products/categories?per_page=50`, { ttl: TTL });
  return (raw || [])
    .filter((c) => c.slug !== 'uncategorized' && (c.count ?? 0) > 0)
    .map((c) => ({ slug: c.slug, name: stripHtml(c.name), count: c.count ?? 0 }))
    .sort((a, b) => b.count - a.count);
}
