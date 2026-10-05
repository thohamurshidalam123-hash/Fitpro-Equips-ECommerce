const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');
const { validateProduct } = require('../validators/productValidators');

const getHighlights = data => Array.from({ length: 4 }, (_, index) => ({
    title: String(data[`highlightTitle${index + 1}`] || '').trim()
})).filter(highlight => highlight.title);

// For loading products with inventory summaries
const getProducts = async ({ page, limit, searchQuery, categoryFilter, statusFilter, minPrice, maxPrice }) => {
    const query = {};
    if (searchQuery) query.productName = { $regex: searchQuery, $options: 'i' };
    if (categoryFilter) {
        const categoryArray = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
        query.categoryId = { $in: categoryArray };
    }
    if (statusFilter && statusFilter !== 'All') query.status = statusFilter;
    if (minPrice || maxPrice) {
        query.regularPrice = {};
        if (minPrice) query.regularPrice.$gte = Number(minPrice);
        if (maxPrice) query.regularPrice.$lte = Number(maxPrice);
    }

    const [products, totalProducts, activeCount, lowStockCount, outOfStock, inventoryValueResult, categories, brands] = await Promise.all([
        Product.find(query).populate('categoryId', 'name').populate('brandId', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Product.countDocuments(query),
        Product.countDocuments({ status: 'Active' }),
        Product.countDocuments({ status: 'Low Stock' }),
        Product.countDocuments({ status: 'Out of Stock' }),
        Product.aggregate([{ $group: { _id: null, totalValue: { $sum: { $multiply: ['$regularPrice', '$availableStock'] } } } }]),
        Category.find({ status: 'Active' }).lean(),
        Brand.find({ status: 'Active' }).select('name categoryId').sort({ name: 1 }).lean()
    ]);

    return {
        products,
        totalProducts,
        activeCount,
        lowStockCount,
        outOfStock,
        totalInventoryValue: inventoryValueResult[0]?.totalValue || 0,
        categories,
        brands,
        totalPages: Math.ceil(totalProducts / limit)
    };
};

// For adding a new product
const createProduct = async ({ data, files }) => {
    const { productName, description, categoryId, brandId, regularPrice, availableStock, status } = data;
    const errors = validateProduct({ ...data, availableStock: availableStock ?? 0 });
    if (!brandId) errors.brandId = 'Brand is required';
    if (!files || files.length < 3) errors.images = 'Please upload at least 3 images';
    if (Object.keys(errors).length) return { success: false, errors };
    if (!await Brand.exists({ _id: brandId, status: 'Active' })) {
        return { success: false, errors: { brandId: 'Please select a valid brand' } };
    }

    const imagePaths = files.map(file => `/uploads/products/${file.filename}`);
    const newProduct = new Product({
        productName: productName.trim(),
        description: description.trim(),
        categoryId,
        brandId,
        regularPrice: Number(regularPrice),
        availableStock: Number(availableStock ?? 0),
        images: imagePaths,
        highlights: getHighlights(data),
        status: status || 'Active'
    });
    await newProduct.save();
    return { success: true };
};

// For editing product details
const updateProduct = async ({ productId, data, files }) => {
    const { productName, categoryId, brandId, regularPrice, availableStock, description, status } = data;
    const product = await Product.findById(productId);
    if (!product) return { statusCode: 404, message: 'Product not found' };

    const errors = validateProduct({ ...data, availableStock: availableStock ?? product.availableStock });
    if (!brandId) errors.brandId = 'Brand is required';
    if (Object.keys(errors).length) return { statusCode: 400, errors };
    if (!await Brand.exists({ _id: brandId, status: 'Active' })) {
        return { statusCode: 400, errors: { brandId: 'Please select a valid brand' } };
    }

    const updateData = {
        productName: productName.trim(),
        categoryId,
        brandId,
        regularPrice: Number(regularPrice),
        description: description.trim(),
        highlights: getHighlights(data),
        status
    };
    if (files && files.length) updateData.images = files.map(file => `/uploads/products/${file.filename}`);
    await Product.findByIdAndUpdate(productId, updateData);
    return { success: true };
};

// For loading product details and active options
const getProductDetails = async (productId) => {
    const [product, categories, brands] = await Promise.all([
        Product.findById(productId).populate('categoryId', 'name').populate('brandId', 'name').lean(),
        Category.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean(),
        Brand.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean()
    ]);
    return { product, categories, brands };
};

// For recalculating total stock based on variants
const recalculateTotalStock = product => {
    if (product.variants && product.variants.length > 0) {
        product.availableStock = product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
    }
    if (product.availableStock === 0) {
        product.status = 'Out of Stock';
    } else if (product.status === 'Out of Stock' && product.availableStock > 0) {
        product.status = 'Active';
    }
};

const validateVariant = ({ variantColor, variantWeight, variantPrice, variantStock }) => {
    const color = String(variantColor || '').trim();
    const weight = Number(variantWeight);
    const price = Number(variantPrice);
    const stock = Number(variantStock);
    if (!color) return { message: 'Please select a variant color.' };
    if (!variantWeight || Number.isNaN(weight) || weight <= 0) return { message: 'Variant weight must be greater than 0.' };
    if (!variantPrice || Number.isNaN(price) || price <= 0) return { message: 'Variant price must be greater than 0.' };
    if (variantStock === undefined || variantStock === null || variantStock === '' || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
        return { message: 'Variant stock must be a whole number greater than or equal to 0.' };
    }
    return { color, weight, price, stock };
};

// For adding a product variant
const createVariant = async ({ productId, data, files }) => {
    const values = validateVariant(data);
    if (values.message) return { statusCode: 400, message: values.message };
    if (!files || files.length < 3) return { statusCode: 400, message: 'Please upload at least 3 images' };

    const product = await Product.findById(productId);
    if (!product) return { statusCode: 404, message: 'Product not found' };
    product.variants.push({
        name: (data.variantName || '').trim(),
        color: values.color,
        weight: values.weight,
        weightUnit: 'kg',
        price: values.price,
        stock: values.stock,
        images: files.map(file => `/uploads/products/${file.filename}`),
        status: values.stock === 0 ? 'Out of Stock' : (data.variantStatus || 'Active')
    });
    recalculateTotalStock(product);
    await product.save();
    return { success: true };
};

// For editing a product variant
const updateVariant = async ({ productId, variantId, data, files }) => {
    const values = validateVariant(data);
    if (values.message) return { statusCode: 400, message: values.message };
    if (files && files.length > 0 && files.length < 3) return { statusCode: 400, message: 'Please upload at least 3 images' };

    const product = await Product.findById(productId);
    if (!product) return { statusCode: 404, message: 'Product not found' };
    const variant = product.variants.id(variantId);
    if (!variant) return { statusCode: 404, message: 'Variant not found' };

    variant.name = (data.variantName || '').trim();
    variant.color = values.color;
    variant.weight = values.weight;
    variant.weightUnit = 'kg';
    variant.price = values.price;
    variant.stock = values.stock;
    if (files && files.length) variant.images = files.map(file => `/uploads/products/${file.filename}`);
    variant.status = values.stock === 0 ? 'Out of Stock' : (data.variantStatus || 'Active');
    recalculateTotalStock(product);
    await product.save();
    return { success: true };
};

// For deleting a product variant
const deleteVariant = async ({ productId, variantId }) => {
    const product = await Product.findById(productId);
    if (!product) return { statusCode: 404, message: 'Product not found' };
    product.variants.pull(variantId);
    recalculateTotalStock(product);
    await product.save();
    return { success: true };
};

module.exports = { getProducts, createProduct, updateProduct, getProductDetails, recalculateTotalStock, createVariant, updateVariant, deleteVariant };
