const Product = require('../models/productModel');
const Category = require('../models/categoryModel');

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
            if (statusFilter === 'In Stock') {
                query.availableStock = { $gt: 5 }; // Customizing threshold
                query.status = 'Active';
            } else if (statusFilter === 'Low Stock') {
                query.availableStock = { $lte: 5, $gt: 0 };
            } else if (statusFilter === 'Out of Stock') {
                query.availableStock = 0;
            }
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
            Product.countDocuments({ status:'Inactive'}),
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
            minPrice,  // Pass to UI to keep fields filled
            maxPrice,  // Pass to UI to keep fields filled
            metrics:{
                active: activeCount,
                inactive: inactiveCount,
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

module.exports = { loadProducts };