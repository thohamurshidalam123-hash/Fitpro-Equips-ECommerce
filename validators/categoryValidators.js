const categoryNamePattern = /^[A-Za-z0-9][A-Za-z0-9 &'()-]*$/;

const validateCategory = (data, { requireImage = false } = {}) => {
    const errors = {};
    const name = String(data.name || '').trim();
    const description = String(data.description || '').trim();

    if (!name) errors.name = 'Category name is required';
    else if (name.length < 2) errors.name = 'Category name must be at least 2 characters long';
    else if (name.length > 80) errors.name = 'Category name cannot exceed 80 characters';
    else if (!categoryNamePattern.test(name)) errors.name = 'Category name contains unsupported characters';

    if (!description) errors.description = 'Description is required';
    else if (description.length < 2) errors.description = 'Description must be at least 2 characters long';
    else if (description.length > 250) errors.description = 'Description cannot exceed 250 characters';

    if (requireImage && !data.image) errors.image = 'Category image is required';
    return errors;
};

const validateCategoryImage = (file) => {
    if (!file) return null;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'].includes(file.mimetype)) {
        return 'Image must be a PNG, JPG, GIF, or SVG file';
    }
    if (file.size > 5 * 1024 * 1024) return 'Image cannot exceed 5 MB';
    return null;
};

module.exports = { validateCategory, validateCategoryImage };
