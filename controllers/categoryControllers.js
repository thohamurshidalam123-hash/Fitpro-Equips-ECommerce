const Category = require('../models/categoryModel');
const { validateCategory, validateCategoryImage } = require('../validators/categoryValidators');

// For loading categories, searching, pagination and sorting
const loadCategories = async (req, res) => {
    try {
        if (!req.session.adminId) return res.redirect('/admin/login');

        let page = parseInt(req.query.page) || 1;
        let limit = 10;
        let searchQuery = req.query.search || '';

        let query = {};
        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const totalCategories = await Category.countDocuments(query);
        const allCategories = await Category.countDocuments();
        const activeCategories = await Category.countDocuments({ status: 'Active' });
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('admin/category', {
            categories,
            page,
            totalPages,
            totalCategories,
            activeCategories,
            inactiveCategories: allCategories - activeCategories,
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
        const { name, description, featured } = req.body || {};
        const errors = validateCategory({ name, description, image: req.file }, { requireImage: true });
        const imageError = validateCategoryImage(req.file);
        if (imageError) errors.image = imageError;
        if (Object.keys(errors).length) {
            return res.status(400).json({ success: false, message: 'Please correct the errors below', errors });
        }
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'Please correct the errors below', errors: { name: 'Category name already exists' } });
        }

        const newCategory = new Category({
            name: name.trim(),
            description: description.trim(),
            featured: featured === 'true',
            image: req.file ? `/uploads/categories/${req.file.filename}` : ''
        });
        await newCategory.save();

        res.json({ success: true, message: 'Category added successfully' });

    } catch (error) {
        console.error('Error adding category: ', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// For editing category
const editCategory = async (req, res) => {
    try{
        const { id, name, description, featured } = req.body || {};
        const errors = validateCategory({ name, description });
        const imageError = validateCategoryImage(req.file);
        if (imageError) errors.image = imageError;
        if (!id) errors.form = 'Category ID is missing';
        if (Object.keys(errors).length) {
            return res.status(400).json({ success: false, message: 'Please correct the errors below', errors });
        }

        const existingCategoryName = await Category.findOne({
            _id: { $ne: id },
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });

        if(existingCategoryName){
            return res.status(400).json({ success: false, message: 'Please correct the errors below', errors: { name: 'Category name already exists' } });
        }

        const updates = {
            name: name.trim(),
            description: description.trim(),
            featured: featured === 'true'
        };
        if (req.file) updates.image = `/uploads/categories/${req.file.filename}`;
        await Category.findByIdAndUpdate(id, updates);
        res.json({success: true, message: 'Category updated successfully'});
    }catch(error){
        console.error('Error in edit category',error.message);
        res.status(500).json({success: false, message: 'Server Error'})
    }
};

// For Deleting category (Toggle Status)
const toggleCategoryStatus = async (req, res) => {
    try{
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);

        if(!category){
            return res.status(404).json({success: false, message: 'Category not found'});
        }

        category.status=category.status === 'Active' ? 'Disabled' : 'Active';
         await category.save();

         res.json({
            success: true,
            status: category.status,
            message: `Category ${category.status === 'Active' ? 'actived' : 'disabled' } successfully`
         });
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

