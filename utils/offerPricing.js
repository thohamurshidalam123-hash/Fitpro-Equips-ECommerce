const getBestOfferPercentage = product => Math.max(
    Number(product?.offerPercentage) || 0,
    Number(product?.categoryId?.offerPercentage) || 0,
    Number(product?.brandId?.offerPercentage) || 0
);

const getBaseProductPrice = product => {
    const salePrice = Number(product?.salePrice) || 0;
    const regularPrice = Number(product?.regularPrice) || 0;
    return salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
};

const getEffectivePrice = (product, variant = null) => {
    const basePrice = Number(variant?.price ?? getBaseProductPrice(product)) || 0;
    const offerPercentage = getBestOfferPercentage(product);
    return Number((basePrice * (1 - offerPercentage / 100)).toFixed(2));
};

module.exports = { getBestOfferPercentage, getBaseProductPrice, getEffectivePrice };