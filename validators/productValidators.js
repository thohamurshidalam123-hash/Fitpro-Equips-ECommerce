const mongoose = require('mongoose');

const productNamePattern = /^[A-Za-z]+(?: +[A-Za-z]+)*$/;
const highlightTitlePattern = /^[A-Za-z]+(?: +[A-Za-z]+)*$/;
const productStatuses = ['Active', 'Low Stock', 'Out of Stock'];

const validateProduct = (data = {}) => {
    const errors = {};
    const productName = String(data.productName || '').trim();
    const description = String(data.description || '').trim();
    const price = Number(data.regularPrice);
    const stock = Number(data.availableStock);

    if (!productName) errors.productName = 'Product name is required';
    else if (productName.length < 2) errors.productName = 'Product name must be at least 2 characters long';
    else if (productName.length > 100) errors.productName = 'Product name cannot exceed 100 characters';
    else if (!productNamePattern.test(productName)) errors.productName = 'Product name can contain only letters and spaces';

    if (!description) errors.description = 'Description is required';
    else if (description.length < 10) errors.description = 'Description must be at least 10 characters long';
    else if (description.length > 1000) errors.description = 'Description cannot exceed 1000 characters';
    else if (description.includes('_')) errors.description = 'Description cannot contain underscores';

    if (!data.categoryId || !mongoose.Types.ObjectId.isValid(data.categoryId)) {
        errors.categoryId = 'Please select a valid category';
    }

    if (!Number.isFinite(price) || price <= 0) errors.regularPrice = 'Price must be greater than 0';
    if (!Number.isInteger(stock) || stock < 0) errors.availableStock = 'Stock must be a whole number of 0 or more';
    if (!productStatuses.includes(data.status)) errors.status = 'Please select a valid status';

    for (let index = 1; index <= 4; index++) {
        const highlightTitle = String(data[`highlightTitle${index}`] || '').trim();
        if (!highlightTitle) errors[`highlightTitle${index}`] = `Highlight ${index} title is required`;
        else if (highlightTitle.length > 60) errors[`highlightTitle${index}`] = `Highlight ${index} title cannot exceed 60 characters`;
        else if (!highlightTitlePattern.test(highlightTitle)) errors[`highlightTitle${index}`] = `Highlight ${index} title can contain only letters and spaces`;
    }

    return errors;
};

module.exports = { validateProduct };
