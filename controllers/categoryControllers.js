const categoryService = require('../services/categoryService');

// For loading categories, searching, pagination and sorting
const loadCategories = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');

        let page = parseInt(req.query.page) || 1;
        let limit = 10;
        let searchQuery = req.query.search || '';

        const data = await categoryService.getCategories({ page, limit, searchQuery });

        res.render('admin/category', {
            ...data,
            page,
            searchQuery,
            currentPage: 'categories'
        });
    } catch (error) {
        console.error('Error loading categories:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// For adding new category
const addCategory = async (req, res) => {
    try {
        const result = await categoryService.createCategory({ ...req.body, image: req.file });
        if (!result.success) {
            return res.status(400).json({ success: false, message: 'Please correct the errors below', errors: result.errors });
        }

        res.json({ success: true, message: 'Category added successfully' });

    } catch (error) {
        console.error('Error adding category: ', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// For editing category
const editCategory = async (req, res) => {
    try{
        const result = await categoryService.updateCategory({ ...req.body, image: req.file });
        if (!result.success) {
            return res.status(400).json({ success: false, message: 'Please correct the errors below', errors: result.errors });
        }
        res.json({success: true, message: 'Category updated successfully'});
    }catch(error){
        console.error('Error in edit category',error.message);
        res.status(500).json({success: false, message: 'Server Error'})
    }
};

// For Deleting category (Toggle Status)
const toggleCategoryStatus = async (req, res) => {
    try{
        const result = await categoryService.toggleCategoryStatus(req.params.id);
        if (!result.success) {
            return res.status(result.statusCode).json({ success: false, message: result.message });
        }
        res.json(result);
    }catch(error){
        console.error('Error in toggling category status',error.message);
        res.status(500).json({success: false, message : 'Server Error'});
    }
};

module.exports = {
    loadCategories,
    addCategory,
    editCategory,
    toggleCategoryStatus
}

