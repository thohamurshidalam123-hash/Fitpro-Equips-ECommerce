const userShopService = require('../services/userShopService');

const loadLandingPage = async (req, res) => {
    try {
        const categories = await userShopService.getLandingCategories();

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

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = 12;
        const search = req.query.search || '';
        const categoryFilter = (Array.isArray(req.query.category) ? req.query.category : [req.query.category || '']).filter(Boolean);
        const brandFilter = (Array.isArray(req.query.brand) ? req.query.brand : [req.query.brand || '']).filter(Boolean);
        const minPrice = req.query.minPrice || '';
        const maxPrice = req.query.maxPrice || '';
        const sortOption = req.query.sort || 'newest';
        const data = await userShopService.getShopPageData({ page, limit, search, categoryFilter, brandFilter, minPrice, maxPrice, sortOption });

        // For rendering view
        res.render('user/shop',{
            products: data.products,
            categories: data.categories,
            brands: data.brands,
            message,
            messageType,
            currentPage: 'shop',
            page,
            totalPages: data.totalPages,
            totalProducts: data.totalProducts,
            //For passing active filters back to UI to keep checkboxes checked and inputs filled
            activeFilters :{
                search,
                category: categoryFilter,
                brand: brandFilter,
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
        const data = await userShopService.getProductDetails(req.params.id);
        if (data.unavailable) {
            req.session.message = 'This product is currently unavailable';
            req.session.messageType = 'error';
            return req.session.save(() => res.redirect('/shop'));
        }

        res.render('user/productDetails', {
            ...data,
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
