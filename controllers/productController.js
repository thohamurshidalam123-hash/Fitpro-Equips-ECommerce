const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');
const { validateProduct } = require('../validators/productValidators');

const getHighlights = (data) => Array.from({ length: 4 }, (_, index) => ({
    title: String(data[`highlightTitle${index + 1}`] || '').trim()
})).filter(highlight => highlight.title);

const loadProducts = async (req, res) => {
    try{
        if(!req.session.adminId) return res.redirect('/admin/login');

        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        let searchQuery = req.query.search || '';
        let categoryFilter = req.query.category || '';
        let brandFilter = req.query.brand || '';
        let statusFilter = req.query.status || '';
        
        // For advanced filters price range
        let minPrice = req.query.minPrice || '';
        let maxPrice = req.query.maxPrice || '';

        // For implementing dynamic query
        let query = {};
        if(searchQuery){
            query.productName = { $regex : searchQuery, $options: 'i'};
        }
        
        // For handling multi-select Category from modal
        if(categoryFilter) {
            const categoryArray = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
            query.categoryId = { $in: categoryArray };
        } 

        // For handling Stock Status logic from Advanced Filters modal
        if (statusFilter && statusFilter !== 'All') {
            query.status = statusFilter;
        }

        // Handle Price Range logic from Advanced Filters modal
        if (minPrice || maxPrice) {
            query.regularPrice = {};
            if (minPrice) query.regularPrice.$gte = Number(minPrice);
            if (maxPrice) query.regularPrice.$lte = Number(maxPrice);
        }

        // For fetching paginated products
        const products = await Product.find(query)
            .populate('categoryId','name')
            .populate('brandId','name')
            .sort({ createdAt : -1})
            .skip(( page-1 ) * limit)
            .limit(limit)
            .lean();

        // For calculationg dashboard card metrics
        const [ totalProducts, activeCount, inactiveCount, outOfStock, inventoryValueResult, categories, brands ] = await Promise.all([
            Product.countDocuments(query),
            Product.countDocuments({ status:'Active'}),
            Product.countDocuments({ status:'Low Stock'}),
            Product.countDocuments({ status:'Out of Stock'}),
            // For calculating total inventory value
            Product.aggregate([{ $group: { _id: null, totalValue: { $sum: { $multiply: ['$regularPrice', '$availableStock'] } } } }]),
            Category.find({ status: 'Active'}).lean(),
            Brand.find({ status: 'Active' }).select('name categoryId').sort({ name: 1 }).lean()
        ]);

        const totalPages = Math.ceil(totalProducts / limit);
        const totalInventoryValue = inventoryValueResult.length > 0 ? inventoryValueResult[0].totalValue : 0;

        res.render('admin/product',{
            products,
            page,
            totalPages,
            limit,
            searchQuery,
            categoryFilter,
            brandFilter,
            statusFilter,
            minPrice,  // For passing to UI to keep fields filled
            maxPrice,  // For passing to UI to keep fields filled
            metrics:{
                active: activeCount,
                lowStock: inactiveCount,
                outOfStock,
                totalValue: totalInventoryValue,
                total: totalProducts
            },
            categories,
            brands,
            successMessage: req.query.success || '',
            currentPage: 'products'
        });
    }catch(error){
        console.error('Error loading products:',error.message);
        res.status(500).send('Server Error');
    }
};


// For adding a new product
const addProduct = async (req, res) => {
    try{
        const { productName, description, categoryId, brandId, regularPrice, availableStock, status } = req.body;
        const errors = validateProduct({ ...req.body, availableStock: availableStock ?? 0 });
        if (!brandId) errors.brandId = 'Brand is required';
        if (!req.files || req.files.length < 3) errors.images = 'Please upload at least 3 images';
        if (Object.keys(errors).length) {
            return res.status(400).json({ success: false, errors, message: 'Please correct the errors below' });
        }
        if (!await Brand.exists({ _id: brandId, status: 'Active' })) {
            return res.status(400).json({ success: false, errors: { brandId: 'Please select a valid brand' }, message: 'Please correct the errors below' });
        }

        // For mapping the Multer filenames to paths for MongoDB
        const imagePaths = req.files.map(file => `/uploads/products/${file.filename}`);

        // For detemining the final status based on stock
        let finalStatus = status || 'Active';
        const newProduct = new Product({
            productName: productName.trim(),
            description: description.trim(),
            categoryId : categoryId,
            brandId,
            regularPrice: Number(regularPrice),
            availableStock: Number(availableStock ?? 0),
            images: imagePaths,
            highlights: getHighlights(req.body),
            status: finalStatus
        });

        await newProduct.save();
        if (String(req.headers.accept || '').includes('text/html')) {
            return res.redirect('/admin/products?success=Product%20added%20successfully');
        }
        return res.json({ success: true, message: 'Product added successfully'});

    }catch(error){
        console.error('Error in adding product:',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For editing product
const editProduct = async (req, res) => {
    try{
        const productId = req.params.id;
        const { productName, categoryId, brandId, regularPrice, availableStock, description, status} = req.body;
        const product = await Product.findById(productId);
        if(!product){
            return res.status(404).json({ success: false, message: 'Product not found'});
        }

        const errors = validateProduct({ ...req.body, availableStock: availableStock ?? product.availableStock });
        if (!brandId) errors.brandId = 'Brand is required';
        if (Object.keys(errors).length) {
            return res.status(400).json({ success: false, errors, message: 'Please correct the errors below' });
        }
        if (!await Brand.exists({ _id: brandId, status: 'Active' })) {
            return res.status(400).json({ success: false, errors: { brandId: 'Please select a valid brand' }, message: 'Please correct the errors below' });
        }

        // For updating product details (text and numerical fields)
        const updateData = {
            productName: productName.trim(),
            categoryId: categoryId,
            brandId,
            regularPrice: Number(regularPrice),
            description: description.trim(),
            highlights: getHighlights(req.body),
            status: status
        };
		if (req.files && req.files.length) updateData.images = req.files.map(file => `/uploads/products/${file.filename}`);

        await Product.findByIdAndUpdate( productId, updateData);

        return res.json({ success:true, message: 'Product updated successfully'});

    }catch(error){
        console.error('Error in editing product',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For getting product details page
const loadProductDetails = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');

        const [product, categories, brands] = await Promise.all([
            Product.findById(req.params.id).populate('categoryId', 'name').populate('brandId', 'name').lean(),
            Category.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean(),
            Brand.find({ status: 'Active' }).select('name').sort({ name: 1 }).lean()
        ]);

        if (!product) return res.status(404).send('Product not found');

        res.render('admin/adminProductDetails', {
            product,
            categories,
            brands,
            currentPage: 'products'
        });
    } catch (error) {
        console.error('Error loading product details:', error.message);
        res.status(500).send('Server Error');
    }
};

// For recalculating total stock based on variants
const recalculateTotalStock = (product) =>{
    if ( product.variants && product.variants.length > 0) {
        // For do sum of stock of all variants
        const totalStock = product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
        product.availableStock = totalStock ;
    }
    
    // Auto-update parent product status based on new total stock
    if(product.availableStock === 0){
        product.status = 'Out of Stock';
    }else if (product.status === 'Out of Stock' && product.available > 0){
        product.status= 'Active' ;
    }
};

// For adding variant
const addVariant = async (req,res) => {
    try{
        const productId = req.params.productId;
        const { variantName, variantColor, variantWeight, variantPrice, variantStock, variantStatus} = req.body;
        const color = String(variantColor || '').trim();
        const weight = Number(variantWeight);
        const price = Number(variantPrice);
        const stock = Number(variantStock);

        if (!color) {
            return res.status(400).json({ success: false, message: 'Please select a variant color.' });
        }
        if (!variantWeight || Number.isNaN(weight) || weight <= 0) {
            return res.status(400).json({ success: false, message: 'Variant weight must be greater than 0.' });
        }
        if (!variantPrice || Number.isNaN(price) || price <= 0) {
            return res.status(400).json({ success: false, message: 'Variant price must be greater than 0.' });
        }
        if (variantStock === undefined || variantStock === null || variantStock === '' || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
            return res.status(400).json({ success: false, message: 'Variant stock must be a whole number greater than or equal to 0.' });
        }

        if (!req.files || req.files.length < 3) {
            return res.status(400).json({ success: false, message: 'Please upload at least 3 images' });
        }

        const product = await Product.findById(productId);
        if(!product) return res.status(404).json({ success: false, message:'Product not found'});

        // Push new variant to product's variants array
        product.variants.push({
            name: (variantName || '').trim(),
            color,
            weight,
            weightUnit: 'kg',
            price,
            stock,
            images: req.files.map(file => `/uploads/products/${file.filename}`),
            status : stock === 0 ? 'Out of Stock' : (variantStatus || 'Active')
        });

        // Processing recalculation of products's total stock
        recalculateTotalStock(product);
        await product.save();

        res.json({ success: true, message: 'Variant added successfully'});
    }catch(error){
        console.error('Add variant error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
     }
};

// For edit variant
const editVariant = async (req, res) => {
    try{
        const { productId, variantId } = req.params;
        const { variantName, variantColor, variantWeight, variantPrice, variantStock, variantStatus} = req.body;
        const color = String(variantColor || '').trim();
        const weight = Number(variantWeight);
        const price = Number(variantPrice);
        const stock = Number(variantStock);

        if (!color) {
            return res.status(400).json({ success: false, message: 'Please select a variant color.' });
        }
        if (!variantWeight || Number.isNaN(weight) || weight <= 0) {
            return res.status(400).json({ success: false, message: 'Variant weight must be greater than 0.' });
        }
        if (!variantPrice || Number.isNaN(price) || price <= 0) {
            return res.status(400).json({ success: false, message: 'Variant price must be greater than 0.' });
        }
        if (variantStock === undefined || variantStock === null || variantStock === '' || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
            return res.status(400).json({ success: false, message: 'Variant stock must be a whole number greater than or equal to 0.' });
        }

        const product = await Product.findById(productId);
        if( !product ) return res.status(404).json({ success: false, message: 'Product not found'});

        const variant = product.variants.id(variantId);
        if (!variant) return res.status(404).json({ success: false, message: 'Variant not found'});

        if (req.files && req.files.length > 0 && req.files.length < 3) {
            return res.status(400).json({ success: false, message: 'Please upload at least 3 images' });
        }

        //Update variant fileds
        variant.name = (variantName || '').trim();
        variant.color = color;
        variant.weight = weight;
        variant.weightUnit = 'kg';
        variant.price = price;
        variant.stock = stock;
        if (req.files && req.files.length) variant.images = req.files.map(file => `/uploads/products/${file.filename}`);

        // For updating statuis automatically
        variant.status = stock === 0 ? 'Out of Stock' : (variantStatus || 'Active');

        // Processing recalculation of stock of product
        recalculateTotalStock(product);
        await product.save();
        
        res.json({ success: true, message: 'Variant updated successfully'});
    }catch(error){
        console.error('Error in editing variant:',error.message);
            res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For deleting variant
const deleteVariant = async (req, res) => {
    try{
        const { productId, variantId } = req.params;

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found'});

        // For pulling(removing) the variant from the array
        product.variant.pull(variantId);

        recalculateTotalStock(product);
        await product.save();

        res.json({ success: true, message: 'Variant removed successfully'});
    }catch(error){
        console.error('Error in variant deletion:',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
}

module.exports = {
    loadProducts ,
    addProduct,
    editProduct,
    loadProductDetails,
    recalculateTotalStock,
    addVariant,
    editVariant,
    deleteVariant
};