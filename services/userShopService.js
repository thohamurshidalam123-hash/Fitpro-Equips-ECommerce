const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');

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
    const products = await Product.find(query)
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .sort(sortQuery)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    products.forEach(product => {
        if (product.variants && product.variants.length) {
            product.availableStock = product.variants.reduce((total, variant) => total + (Number(variant.stock) || 0), 0);
        }
    });
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
        .populate('categoryId', 'name status')
        .populate('brandId', 'name status')
        .lean();
    if (!product || product.status !== 'Active' || product.availableStock <= 0 || !product.categoryId || product.categoryId.status !== 'Active') {
        return { unavailable: true };
    }

    const relatedProducts = await Product.find({
        categoryId: product.categoryId._id,
        _id: { $ne: product._id },
        status: 'Active',
        availableStock: { $gt: 0 }
    }).populate('brandId', 'name').limit(4).lean();
    return { product, relatedProducts };
};

module.exports = { getLandingCategories, getShopPageData, getProductDetails };
