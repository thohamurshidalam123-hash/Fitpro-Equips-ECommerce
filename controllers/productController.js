const productService = require('../services/productService');

const loadProducts = async (req, res) => {
    try{
        if(!req.session.adminId) return res.redirect('/admin/login');

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const searchQuery = req.query.search || '';
        const categoryFilter = req.query.category || '';
        const brandFilter = req.query.brand || '';
        const statusFilter = req.query.status || '';
        const minPrice = req.query.minPrice || '';
        const maxPrice = req.query.maxPrice || '';
        const data = await productService.getProducts({ page, limit, searchQuery, categoryFilter, statusFilter, minPrice, maxPrice });

        res.render('admin/product',{
            products: data.products,
            page,
            totalPages: data.totalPages,
            limit,
            searchQuery,
            categoryFilter,
            brandFilter,
            statusFilter,
            minPrice,  // For passing to UI to keep fields filled
            maxPrice,  // For passing to UI to keep fields filled
            metrics: {
                active: data.activeCount,
                lowStock: data.lowStockCount,
                outOfStock: data.outOfStock,
                totalValue: data.totalInventoryValue,
                total: data.totalProducts
            },
            categories: data.categories,
            brands: data.brands,
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
        const result = await productService.createProduct({ data: req.body, files: req.files });
        if (!result.success) {
            return res.status(400).json({ success: false, errors: result.errors, message: 'Please correct the errors below' });
        }
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
        const result = await productService.updateProduct({ productId: req.params.id, data: req.body, files: req.files });
        if (!result.success) {
            if (result.statusCode === 404) return res.status(404).json({ success: false, message: result.message });
            return res.status(result.statusCode).json({ success: false, errors: result.errors, message: 'Please correct the errors below' });
        }

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

        const { product, categories, brands } = await productService.getProductDetails(req.params.id);

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

// For adding variant
const addVariant = async (req,res) => {
    try{
        const result = await productService.createVariant({ productId: req.params.productId, data: req.body, files: req.files });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json({ success: true, message: 'Variant added successfully'});
    }catch(error){
        console.error('Add variant error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error'});
     }
};

// For edit variant
const editVariant = async (req, res) => {
    try{
        const result = await productService.updateVariant({ ...req.params, data: req.body, files: req.files });
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json({ success: true, message: 'Variant updated successfully'});
    }catch(error){
        console.error('Error in editing variant:',error.message);
            res.status(500).json({ success: false, message: 'Server Error'});
    }
};

// For deleting variant
const deleteVariant = async (req, res) => {
    try{
        const result = await productService.deleteVariant(req.params);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
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
    addVariant,
    editVariant,
    deleteVariant
};