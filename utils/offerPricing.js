const getBestOfferPercentage = product => Math.max(
    Number(product?.offerPercentage) || 0,
    Number(product?.categoryId?.offerPercentage) || 0,
    Number(product?.brandId?.offerPercentage) || 0
);

const getHighestVariantPrice = product => {
    const prices = (Array.isArray(product?.variants) ? product.variants : [])
        .filter(variant => Number(variant.stock) > 0)
        .map(variant => Number(variant.price))
        .filter(Number.isFinite);
    return prices.length ? Math.max(...prices) : null;
};

const getBaseProductPrice = product => {
    const highestVariantPrice = getHighestVariantPrice(product);
    const salePrice = Number(product?.salePrice) || 0;
    const regularPrice = highestVariantPrice ?? (Number(product?.regularPrice) || 0);
    return highestVariantPrice === null && salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
};

const getEffectivePrice = (product, variant = null) => {
    const basePrice = Number(variant?.price ?? getBaseProductPrice(product)) || 0;
    const offerPercentage = getBestOfferPercentage(product);
    return Number((basePrice * (1 - offerPercentage / 100)).toFixed(2));
};

module.exports = { getBestOfferPercentage, getBaseProductPrice, getHighestVariantPrice, getEffectivePrice };