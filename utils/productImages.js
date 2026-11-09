const getProductDisplayImages = product => {
    const variants = product.variants || [];
    const defaultVariant = variants.find(variant => Number(variant.stock) > 0) || variants[0];
    return defaultVariant?.images?.length ? defaultVariant.images : (product.images || []);
};

module.exports = { getProductDisplayImages };