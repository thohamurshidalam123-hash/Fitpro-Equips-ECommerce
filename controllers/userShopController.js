const Product = require ('../models/productModel');
const Category = require ('../models/categoryModel');

const loadLandingPage = async (req, res) => {
    try {
        const categories = await Category.find({ status: 'Active' })
            .sort({ createdAt: -1 })
            .lean();

        res.render('user/landing', { currentPage: 'home', categories });
    } catch (error) {
        console.error('Error in loading landing page:', error.message);
        res.status(500).send('Server Error while loading landing page');
    }
};

const loadShopPage = async (req, res) => {
    try{
        const message = req.session.message || null;
        const messageType = req.session.messageType || 'error';
        delete req.session.message;
        delete req.session.messageType;

        // For pagination
        let page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        let limit = 12;

        // For extracting query parameters from from
        let search = req.query.search || '';
        let categoryFilter = req.query.category || [];
        categoryFilter = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
        categoryFilter = categoryFilter.filter(Boolean);
        let minPrice = req.query.minPrice || '';
        let maxPrice = req.query.maxPrice || '';
        let sortOption = req.query.sort || 'newest';

        // For fecthing only active categories
        const activeCategories = await Category.find({ status:'Active' }).lean();
        const activeCategoryId = activeCategories.map( cat => cat._id.toString());

        // For build dynamic query object
        // For starting by strictly enforcing that the product is Active AND its category is Active
        let query ={
            status: 'Active',
            availableStock: { $gt: 0 },
            categoryId: { $in: activeCategoryId}
        };

        // Apply searching(with product name)
        if(search){
            query.productName = { $regex: search, $options: 'i' };
        }

        //For apply category checkboxes filter
        if (categoryFilter.length){
            // For only allowing filtering by categories that are actually active
            const validCategories = categoryFilter.filter(id => activeCategoryId.includes(id));
            if(validCategories.length > 0){
                query.categoryId = { $in: validCategories };
            }
        }

        //For applying price range filter
        if(minPrice || maxPrice){
            query.regularPrice = {};
            if(minPrice && Number.isFinite(Number(minPrice))) query.regularPrice.$gte = Number(minPrice);
            if(maxPrice && Number.isFinite(Number(maxPrice))) query.regularPrice.$lte = Number(maxPrice);
        }

        //For apply sorting options
        let sortQuery = {};
        switch (sortOption){
            case 'price_asc' :
                sortQuery = { regularPrice: 1 };
                break;
            case 'price_desc':
                sortQuery = { regularPrice: -1 };
                break;
            case 'a_z':
                sortQuery = { productName: 1 };
                break;
            case 'z_a':
                sortQuery = { productName: -1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        // For executin query with pagination
        const products = await Product.find(query)
        .populate('categoryId', 'name')
        .sort(sortQuery)
        .skip((page-1)*limit)
        .limit(limit)
        .lean();

        // For getting the total count of pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts/limit);

        // For rendering view
        res.render('user/shop',{
            products,
            categories: activeCategories,
            message,
            messageType,
            currentPage: 'shop',
            page,
            totalPages,
            totalProducts,
            //For passing active filters back to UI to keep checkboxes checked and inputs filled
            activeFilters :{
                search,
                category: categoryFilter,
                minPrice,
                maxPrice,
                sort: sortOption
            }
        });
    }catch(error){
        console.error('Erro in loading shop page:',error.message);
        res.status(500).send('Server Error while loading shop');
    }
};

const productDetailsPage = async (req,res) => {
    try{
        const productId = req.params.id;

        const product = await Product.findById(productId)
        .populate('categoryId', 'name status')
        .lean();

        if(!product || product.status !== 'Active' || product.availableStock <= 0 || !product.categoryId || product.categoryId.status !== 'Active'){
            req.session.message = 'This product is currently unavailable';
            req.session.messageType = 'error';
            return req.session.save(() => res.redirect('/shop'));
        }

        // For showing related products
        const relatedProducts = await Product.find({
            categoryId: product.categoryId._id,
            _id: { $ne: product._id },
            status: 'Active',
            availableStock: { $gt: 0 }
        })
        .limit(4)
        .lean();

        res.render('user/productDetails',{
            product,relatedProducts,
            currentPage: 'shop'
        });
    }catch(error){
        console.error('Error in loading product details page',error.message);

    res.redirect('/shop');
    }
};

module.exports = { 
    loadLandingPage,
    loadShopPage,
    productDetailsPage
};
