const brandService = require('../services/brandService');
const isHtmlFormRequest = req => String(req.headers.accept || '').includes('text/html');

const loadBrands = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');
                
        const searchQuery = String(req.query.search || '').trim();
        const statusFilter = String(req.query.status || '').trim();
        const categoryFilter = String(req.query.category || '').trim();
        const data = await brandService.getBrands({
            page: Math.max(parseInt(req.query.page, 10) || 1, 1),
            limit: 10,
            searchQuery,
            statusFilter,
            categoryFilter
        });

        res.render('admin/brands', { ...data, currentPage: 'brands' });
    } catch (error) {
        console.error('Error loading brands:', error.message);
        res.status(500).send('Server Error');
    }
};

const loadBrandDetails = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');

        const data = await brandService.getBrandDetails({
            brandId: req.params.id,
            page: Math.max(parseInt(req.query.page, 10) || 1, 1),
            limit: 10
        });
        const brand = data?.brand;
        if (!brand) return res.status(404).send('Brand not found');

        res.render('admin/brandDetails', { ...data, currentPage: 'brands' });
    } catch (error) {
        console.error('Error loading brand details:', error.message);
        res.status(500).send('Server Error');
    }
};

const addBrand = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = String(req.body.description || '').trim();
        const categoryId = String(req.body.categoryId || '').trim();
        const result = await brandService.createBrand({
            name,
            description,
            categoryId,
            featured: req.body.featured === 'true',
            offerPercentage: req.body.offerPercentage,
            logo: req.file
        });
        if (!result.success) return res.status(400).json({ success: false, errors: result.errors });
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
        const result = await brandService.updateBrand({
            id: req.body.id,
            name,
            description,
            categoryId,
            featured: req.body.featured === 'true',
            offerPercentage: req.body.offerPercentage,
            logo: req.file
        });
        if (!result.success) return res.status(400).json({ success: false, errors: result.errors });
        if (isHtmlFormRequest(req)) return res.redirect('/admin/brands?success=Brand%20updated%20successfully');
        res.json({ success: true, message: 'Brand updated successfully' });
    } catch (error) {
        console.error('Error editing brand:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const toggleBrandStatus = async (req, res) => {
    try {
        const result = await brandService.toggleBrandStatus(req.params.id);
        if (!result.success) return res.status(result.statusCode).json({ success: false, message: result.message });
        res.json(result);
    } catch (error) {
        console.error('Error toggling brand status:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = { loadBrands, loadBrandDetails, addBrand, editBrand, toggleBrandStatus };
