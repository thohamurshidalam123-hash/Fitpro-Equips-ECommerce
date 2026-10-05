const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');
const Product = require('../models/productModel');
const { validateCategory, validateCategoryImage } = require('../validators/categoryValidators');

// For loading categories with brand and product counts
const getCategories = async ({ page, limit, searchQuery }) => {
    const query = {};
    if (searchQuery) query.name = { $regex: searchQuery, $options: 'i' };

    const categories = await Category.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    const categoryIds = categories.map(category => category._id);
    const [brandCounts, productCounts, totalCategories, allCategories, activeCategories] = await Promise.all([
        Brand.aggregate([
            { $match: { categoryId: { $in: categoryIds } } },
            { $group: { _id: '$categoryId', count: { $sum: 1 } } }
        ]),
        Product.aggregate([
            { $match: { categoryId: { $in: categoryIds } } },
            { $group: { _id: '$categoryId', count: { $sum: 1 }, stock: { $sum: { $ifNull: ['$availableStock', 0] } } } }
        ]),
        Category.countDocuments(query),
        Category.countDocuments(),
        Category.countDocuments({ status: 'Active' })
    ]);

    const brandCountMap = new Map(brandCounts.map(item => [String(item._id), item.count]));
    const productSummaryMap = new Map(productCounts.map(item => [String(item._id), item]));
    categories.forEach(category => {
        category.brandCount = brandCountMap.get(String(category._id)) || 0;
        const summary = productSummaryMap.get(String(category._id));
        category.productCount = summary?.count || 0;
        category.totalStock = summary?.stock || 0;
    });

    return {
        categories,
        totalCategories,
        activeCategories,
        inactiveCategories: allCategories - activeCategories,
        totalPages: Math.ceil(totalCategories / limit)
    };
};

// For adding a new category
const createCategory = async ({ name, description, featured, image }) => {
    const errors = validateCategory({ name, description, image }, { requireImage: true });
    const imageError = validateCategoryImage(image);
    if (imageError) errors.image = imageError;
    if (Object.keys(errors).length) return { success: false, errors };

    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (existingCategory) return { success: false, errors: { name: 'Category name already exists' } };

    await Category.create({
        name: name.trim(),
        description: description.trim(),
        featured: featured === 'true',
        image: image ? `/uploads/categories/${image.filename}` : ''
    });
    return { success: true };
};

// For editing a category
const updateCategory = async ({ id, name, description, featured, image }) => {
    const errors = validateCategory({ name, description });
    const imageError = validateCategoryImage(image);
    if (imageError) errors.image = imageError;
    if (!id) errors.form = 'Category ID is missing';
    if (Object.keys(errors).length) return { success: false, errors };

    const existingCategory = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (existingCategory) return { success: false, errors: { name: 'Category name already exists' } };

    const updates = {
        name: name.trim(),
        description: description.trim(),
        featured: featured === 'true'
    };
    if (image) updates.image = `/uploads/categories/${image.filename}`;
    await Category.findByIdAndUpdate(id, updates);
    return { success: true };
};

// For toggling category status
const toggleCategoryStatus = async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) return { statusCode: 404, message: 'Category not found' };

    category.status = category.status === 'Active' ? 'Disabled' : 'Active';
    await category.save();
    return {
        success: true,
        status: category.status,
        message: `Category ${category.status === 'Active' ? 'actived' : 'disabled'} successfully`
    };
};

module.exports = { getCategories, createCategory, updateCategory, toggleCategoryStatus };
