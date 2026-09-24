const Brand = require('../models/brandModel');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const fs = require('fs');

const createBrandSlug = name => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isHtmlFormRequest = req => String(req.headers.accept || '').includes('text/html');

const loadBrands = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');
                
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = 10;
        const searchQuery = String(req.query.search || '').trim();
        const statusFilter = String(req.query.status || '').trim();
        const categoryFilter = String(req.query.category || '').trim();
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

        res.render('admin/brands', {
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
            categoryFilter,
            currentPage: 'brands'
        });
    } catch (error) {
        console.error('Error loading brands:', error.message);
        res.status(500).send('Server Error');
    }
};

const loadBrandDetails = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = 10;
        const brand = await Brand.findById(req.params.id).populate('categoryId', 'name').lean();
        if (!brand) return res.status(404).send('Brand not found');

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

        res.render('admin/brandDetails', {
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
            lowStockProducts,
            currentPage: 'brands'
        });
    } catch (error) {
        console.error('Error loading brand details:', error.message);
        res.status(500).send('Server Error');
    }
};

const validateBrand = (name, description) => {
    const errors = {};
    if (!name) errors.name = 'Brand name is required';
    else if (!/^[A-Za-z0-9][A-Za-z0-9 &'().-]*$/.test(name)) errors.name = 'Brand name contains unsupported characters';
    if (!description) errors.description = 'Brand description is required';
    else if (description.length > 250) errors.description = 'Brand description cannot exceed 250 characters';
    return errors;
};

const addBrand = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = String(req.body.description || '').trim();
        const categoryId = String(req.body.categoryId || '').trim();
        const errors = validateBrand(name, description);
        if (!categoryId) errors.categoryId = 'Category is required';
        if (!req.file) errors.logo = 'Brand image is required';
        else if (!['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
            fs.unlink(req.file.path, () => {});
            errors.logo = 'Only JPEG or PNG images are allowed';
        }
        if (Object.keys(errors).length) return res.status(400).json({ success: false, errors });
        if (!await Category.exists({ _id: categoryId, status: 'Active' })) return res.status(400).json({ success: false, errors: { categoryId: 'Please select a valid category' } });
        const duplicate = await Brand.findOne({ name: new RegExp(`^${name}$`, 'i') });
        if (duplicate) return res.status(400).json({ success: false, errors: { name: 'Brand name already exists' } });
        const slug = `${createBrandSlug(name)}-${Date.now()}`;
        await Brand.create({ name, slug, description, categoryId, featured: req.body.featured === 'true', logo: `/uploads/brands/${req.file.filename}` });
        if (isHtmlFormRequest(req)) return res.redirect('/admin/brands?success=Brand%20added%20successfully');
        res.json({ success: true, message: 'Brand added successfully' });
    } catch (error) {
        console.error('Error adding brand:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const editBrand = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = String(req.body.description || '').trim();
        const categoryId = String(req.body.categoryId || '').trim();
        const errors = validateBrand(name, description);
        if (!categoryId) errors.categoryId = 'Category is required';
        if (!req.body.id) errors.form = 'Brand ID is missing';
        if (Object.keys(errors).length) return res.status(400).json({ success: false, errors });
        if (!await Category.exists({ _id: categoryId, status: 'Active' })) return res.status(400).json({ success: false, errors: { categoryId: 'Please select a valid category' } });
        const duplicate = await Brand.findOne({ _id: { $ne: req.body.id }, name: new RegExp(`^${name}$`, 'i') });
        if (duplicate) return res.status(400).json({ success: false, errors: { name: 'Brand name already exists' } });
        const updates = { name, description, categoryId, featured: req.body.featured === 'true' };
        if (req.file) updates.logo = `/uploads/brands/${req.file.filename}`;
        await Brand.findByIdAndUpdate(req.body.id, updates);
        if (isHtmlFormRequest(req)) return res.redirect('/admin/brands?success=Brand%20updated%20successfully');
        res.json({ success: true, message: 'Brand updated successfully' });
    } catch (error) {
        console.error('Error editing brand:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const toggleBrandStatus = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
        brand.status = brand.status === 'Active' ? 'Disabled' : 'Active';
        await brand.save();
        res.json({ success: true, status: brand.status, message: `Brand ${brand.status === 'Active' ? 'activated' : 'disabled'} successfully` });
    } catch (error) {
        console.error('Error toggling brand status:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = { loadBrands, loadBrandDetails, addBrand, editBrand, toggleBrandStatus };
