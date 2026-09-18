const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
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
            [] // Empty array for brands for now
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
        const { productName, description, categoryId, regularPrice, availableStock, status } = req.body;
        const errors = validateProduct(req.body);
        if (!req.files || req.files.length < 3) errors.images = 'Please upload at least 3 images';
        if (Object.keys(errors).length) {
            return res.status(400).json({ success: false, errors, message: 'Please correct the errors below' });
        }

        // For mapping the Multer filenames to paths for MongoDB
        const imagePaths = req.files.map(file => `/uploads/products/${file.filename}`);

        // For detemining the final status based on stock
        let finalStatus = status || 'Active';
        const newProduct = new Product({
            productName: productName.trim(),
            description: description.trim(),
            categoryId : categoryId,
            regularPrice: Number(regularPrice),
            availableStock: Number(availableStock),
            images: imagePaths,
            highlights: getHighlights(req.body),
            status: finalStatus
        });

        await newProduct.save();
        return res.json({ success: true, message: 'Product added successfully'});

    }catch(error){
        console.error('Error in adding product:',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

const editProduct = async (req, res) => {
    try{
        const productId = req.params.id;
        const { productName, categoryId, regularPrice, availableStock, description, status} = req.body;
        const errors = validateProduct(req.body);
        if (Object.keys(errors).length) {
            return res.status(400).json({ success: false, errors, message: 'Please correct the errors below' });
        }

        const product = await Product.findById(productId);
        if(!product){
            return res.status(404).json({ success: false, message: 'Product not found'});
        }

        // For updating product details (text and numerical fields)
        const updateData = {
            productName: productName.trim(),
            categoryId: categoryId,
            regularPrice: Number(regularPrice),
            availableStock: Number(availableStock),
            description: description.trim(),
            highlights: getHighlights(req.body),
            status: status
        };

        await Product.findByIdAndUpdate( productId, updateData);

        return res.json({ success:true, message: 'Product updated successfully'});

    }catch(error){
        console.error('Error in editing product',error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
    }
};

module.exports = {
    loadProducts ,
    addProduct,
    editProduct

};