const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');
const { getBestOfferPercentage, getEffectivePrice } = require('../utils/offerPricing');

// For loading active categories on the landing page
const getLandingCategories = async () => Category.find({ status: 'Active' }).sort({ createdAt: -1 }).lean();

// For loading shop products with filters and pagination
const getShopPageData = async ({ page, limit, search, categoryFilter, brandFilter, minPrice, maxPrice, sortOption }) => {
    const activeCategories = await Category.find({ status: 'Active' }).lean();
    const activeCategoryIds = activeCategories.map(category => category._id.toString());
    const activeBrands = await Brand.find({ status: 'Active' }).sort({ name: 1 }).lean();
    const activeBrandIds = activeBrands.map(brand => brand._id.toString());
    const query = { status: 'Active', categoryId: { $in: activeCategoryIds } };

    if (search) query.productName = { $regex: search, $options: 'i' };
    if (categoryFilter.length) {
        const validCategories = categoryFilter.filter(id => activeCategoryIds.includes(id));
        if (validCategories.length) query.categoryId = { $in: validCategories };
    }
    if (brandFilter.length) {
        const validBrands = brandFilter.filter(id => activeBrandIds.includes(id));
        if (validBrands.length) query.brandId = { $in: validBrands };
    }
    if (minPrice || maxPrice) {
        query.regularPrice = {};
        if (minPrice && Number.isFinite(Number(minPrice))) query.regularPrice.$gte = Number(minPrice);
        if (maxPrice && Number.isFinite(Number(maxPrice))) query.regularPrice.$lte = Number(maxPrice);
    }

    const sortQueries = {
        price_asc: { regularPrice: 1 },
        price_desc: { regularPrice: -1 },
        a_z: { productName: 1 },
        z_a: { productName: -1 }
    };
    const sortQuery = sortQueries[sortOption] || { createdAt: -1 };
    let products = await Product.find(query)
        .populate('categoryId', 'name offerPercentage')
        .populate('brandId', 'name offerPercentage')
        .sort(sortQuery)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    
    //For dynamic offer logic
    products = products.map(product => {
        // Calculating stock
        let availableStock = Number(product.availableStock) || 0;
        if (product.variants && product.variants.length) {
            availableStock = product.variants.reduce((total, variant) => total + (Number(variant.stock) || 0), 0);
        }

        // For finding best offer
        const bestOfferPercentage = getBestOfferPercentage(product);
        const finalPrice = getEffectivePrice(product);

        return {
            ...product,
            availableStock,
            bestOfferPercentage,
            displayPrice : finalPrice
        }

    })
    const totalProducts = await Product.countDocuments(query);
    return {
        products,
        categories: activeCategories,
        brands: activeBrands,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit)
    };
};

// For loading product details and related products
const getProductDetails = async productId => {
    const product = await Product.findById(productId)
        .populate('categoryId', 'name status offerPercentage')
        .populate('brandId', 'name status offerPercentage')
        .lean();
    if (!product || product.status !== 'Active' || product.availableStock <= 0 || !product.categoryId || product.categoryId.status !== 'Active') {
        return { unavailable: true };
    }

    // For dynamic offer logic for single product
    const bestOfferPercentage = getBestOfferPercentage(product);
    const finalPrice = getEffectivePrice(product);

    // For attaching to product
    product.bestOfferPercentage = bestOfferPercentage;
    product.displayPrice = finalPrice; 

    let relatedProducts = await Product.find({
        categoryId: product.categoryId._id,
        _id: { $ne: product._id },
        status: 'Active',
        availableStock: { $gt: 0 }
    }).populate('brandId', 'name offerPercentage').populate('categoryId', 'offerPercentage').limit(4).lean();
    
    relatedProducts = relatedProducts.map(rp => {
        const best = getBestOfferPercentage(rp);
        const rpFinalPrice = getEffectivePrice(rp);
        
        return { ...rp, bestOfferPercentage: best, displayPrice: rpFinalPrice };
    });

    return { product, relatedProducts };
};

module.exports = { getLandingCategories, getShopPageData, getProductDetails };
