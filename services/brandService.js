const fs = require('fs');
const Brand = require('../models/brandModel');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

const createBrandSlug = name => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const validateBrand = (name, description) => {
    const errors = {};
    if (!name) errors.name = 'Brand name is required';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 &'().-]*$/.test(name)) errors.name = 'Brand name contains unsupported characters';
    if (!description) errors.description = 'Brand description is required';
    else if (description.length > 250) errors.description = 'Brand description cannot exceed 250 characters';
    return errors;
};

// For loading brands with product summary details
const getBrands = async ({ page, limit, searchQuery, statusFilter, categoryFilter }) => {
    const query = {};
    if (searchQuery) query.name = { $regex: searchQuery, $options: 'i' };
    if (statusFilter) query.status = statusFilter;
    if (categoryFilter) query.categoryId = categoryFilter;

    const [brands, totalBrands, activeBrands, inactiveBrands, categories, lowStockBrandIds] = await Promise.all([
        Brand.find(query).populate('categoryId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Brand.countDocuments(query),
        Brand.countDocuments({ ...query, status: 'Active' }),
        Brand.countDocuments({ ...query, status: 'Disabled' }),
        Category.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean(),
        Product.distinct('brandId', { availableStock: { $lt: 20 }, brandId: { $ne: null } })
    ]);

    const brandIds = brands.map(brand => brand._id);
    const productCounts = await Product.aggregate([
        { $match: { brandId: { $in: brandIds } } },
        { $group: { _id: '$brandId', count: { $sum: 1 }, revenue: { $sum: { $multiply: ['$regularPrice', '$availableStock'] } } } }
    ]);
    const countMap = new Map(productCounts.map(item => [String(item._id), item]));
    brands.forEach(brand => {
        const summary = countMap.get(String(brand._id)) || { count: 0, revenue: 0 };
        brand.productCount = summary.count;
        brand.revenue = summary.revenue;
    });

    return {
        brands,
        categories,
        page,
        limit,
        totalPages: Math.ceil(totalBrands / limit),
        totalBrands,
        activeBrands,
        inactiveBrands,
        lowStockBrands: lowStockBrandIds.length,
        searchQuery,
        statusFilter,
        categoryFilter
    };
};

// For loading products belonging to a brand
const getBrandDetails = async ({ brandId, page, limit }) => {
    const brand = await Brand.findById(brandId).populate('categoryId', 'name').lean();
    if (!brand) return null;

    const productQuery = { brandId: brand._id };
    const [products, totalProducts, revenueResult, activeProducts, outOfStockProducts, lowStockProducts, categories] = await Promise.all([
        Product.find(productQuery).populate('categoryId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Product.countDocuments(productQuery),
        Product.aggregate([{ $match: productQuery }, { $group: { _id: null, total: { $sum: { $multiply: ['$regularPrice', '$availableStock'] } } } }]),
        Product.countDocuments({ ...productQuery, status: 'Active' }),
        Product.countDocuments({ ...productQuery, status: 'Out of Stock' }),
        Product.countDocuments({ ...productQuery, status: 'Low Stock' }),
        Category.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean()
    ]);

    return {
        brand,
        products,
        categories,
        page,
        limit,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
        revenue: revenueResult[0]?.total || 0,
        activeProducts,
        outOfStockProducts,
        lowStockProducts
    };
};

// For adding a new brand
const createBrand = async ({ name, description, categoryId, featured, logo }) => {
    const errors = validateBrand(name, description);
    if (!categoryId) errors.categoryId = 'Category is required';
    if (!logo) errors.logo = 'Brand image is required';
    else if (!['image/jpeg', 'image/png'].includes(logo.mimetype)) {
        fs.unlink(logo.path, () => {});
        errors.logo = 'Only JPEG or PNG images are allowed';
    }
    if (Object.keys(errors).length) return { success: false, errors };
    if (!await Category.exists({ _id: categoryId, status: 'Active' })) {
        return { success: false, errors: { categoryId: 'Please select a valid category' } };
    }
    const duplicate = await Brand.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (duplicate) return { success: false, errors: { name: 'Brand name already exists' } };

    const slug = `${createBrandSlug(name)}-${Date.now()}`;
    await Brand.create({ name, slug, description, categoryId, featured, logo: `/uploads/brands/${logo.filename}` });
    return { success: true };
};

// For editing a brand
const updateBrand = async ({ id, name, description, categoryId, featured, logo }) => {
    const errors = validateBrand(name, description);
    if (!categoryId) errors.categoryId = 'Category is required';
    if (!id) errors.form = 'Brand ID is missing';
    if (Object.keys(errors).length) return { success: false, errors };
    if (!await Category.exists({ _id: categoryId, status: 'Active' })) {
        return { success: false, errors: { categoryId: 'Please select a valid category' } };
    }
    const duplicate = await Brand.findOne({ _id: { $ne: id }, name: new RegExp(`^${name}$`, 'i') });
    if (duplicate) return { success: false, errors: { name: 'Brand name already exists' } };

    const updates = { name, description, categoryId, featured };
    if (logo) updates.logo = `/uploads/brands/${logo.filename}`;
    await Brand.findByIdAndUpdate(id, updates);
    return { success: true };
};

// For toggling brand status
const toggleBrandStatus = async (brandId) => {
    const brand = await Brand.findById(brandId);
    if (!brand) return { statusCode: 404, message: 'Brand not found' };
    brand.status = brand.status === 'Active' ? 'Disabled' : 'Active';
    await brand.save();
    return { success: true, status: brand.status, message: `Brand ${brand.status === 'Active' ? 'activated' : 'disabled'} successfully` };
};

module.exports = { getBrands, getBrandDetails, createBrand, updateBrand, toggleBrandStatus };
