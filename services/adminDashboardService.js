const Order = require('../models/orderModel');
const User = require('../models/user');
const Product = require('../models/productModel');

const getDashboardStats = async () => {
    // For show basic status
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: { $in: ['Pending', 'Processing', 'Packed', 'Shipped']}});
    const completedOrders = await Order.countDocuments({ orderStatus: 'Delivered' });

    // For calculating total revenue from delivered orders
    const revenueResult = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' }},
        { $group: {_id: null, totalRevenue: { $sum: '$grandTotal' }}}
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // For showing user cards
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin'}}); 
    const activeUsers = await User.countDocuments({ isBlocked: false, role: { $ne: 'admin' }});
    const blockedUsers = await User.countDocuments({ isBlocked: true, role: { $ne: 'admin'}});

    // For showing top ten products in sales
    const topProducts = await Order.aggregate([
        { $match: { orderStatus: 'Delivered'}},
        { $unwind: '$items' },
        { $group: {
            _id: '$items.productId',
            productName: { $first: '$items.name' },
            totalQuantitySold: { $sum: '$items.quantity' }
        }},
        { $sort: { totalQuantitySold: -1 }},{$limit: 10}
    ]);

    // For showing top ten categories in sales
    const topCategories = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'product'
        }},
        { $unwind: '$product' },
        { $lookup: {
            from: 'categories',
            localField: 'product.categoryId',
            foreignField: '_id',
            as: 'category'
        }},
        { $unwind: '$category' },
        { $group: {
            _id: '$category._id',
            categoryName: { $first: '$category.name' },
            totalQuantitySold: { $sum: '$items.quantity' }
        }},
        { $sort: { totalQuantitySold: -1 } },         {$limit: 10 }
    ]);

    // For top ten brands in sales
    const topBrands = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $lookup: {
            from: 'products', 
            localField: 'items.productId',
            foreignField: '_id',
            as: 'product'
        }},
        { $unwind: '$product' },
        { $lookup: {
            from: 'brands', // ensure this matches your MongoDB collection name for brands
            localField: 'product.brandId',
            foreignField: '_id',
            as: 'brand'
        }},
        { $unwind: '$brand' },
        { $group: {
            _id: '$brand._id',
            brandName: { $first: '$brand.name' },
            totalQuantitySold: { $sum: '$items.quantity' }
        }},
        { $sort: { totalQuantitySold: -1 } },         {$limit: 10 }
    ]);

    // For showing chart data (monthly for current year)
    const currentYear = new Date().getFullYear();
    const monthlySales = await Order.aggregate([
        { 
            $match: { 
                orderStatus: 'Delivered',
                createdAt: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
            } 
        },
        {
            $group: {
                _id: { $month: '$createdAt' },
                revenue: { $sum: '$grandTotal' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const monthlyDataArray = new Array(12).fill(0);
    monthlySales.forEach(sale => {
        monthlyDataArray[sale._id - 1] = sale.revenue;
    });

    // For char data ( yearly for last 5 years)
    const yearlySales = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $group: {
            _id: { $year: '$createdAt' },
            revenue: { $sum: '$grandTotal' }
        }},
        { $sort: { _id: 1 } }
    ]);

    const yearlyLabels = [];
    const yearlyDataArray = [];
    yearlySales.forEach(sale => {
        yearlyLabels.push(sale._id.toString());
        yearlyDataArray.push(sale.revenue);
    });

    // For showing chart data (weekly - last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weeklySales = await Order.aggregate([
        { 
            $match: { 
                orderStatus: 'Delivered',
                createdAt: { $gte: sevenDaysAgo }
            } 
        },
        {
            $group: {
                _id: { $dayOfWeek: '$createdAt' }, // 1 (Sunday) to 7 (Saturday)
                revenue: { $sum: '$grandTotal' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyLabels = [];
    const weeklyDataArray = new Array(7).fill(0);

    // Align array for make today is the end
    const todayDayIndex = new Date().getDay(); // 0-6
    for(let i = 6; i >= 0; i--) {
        let dIndex = todayDayIndex - i;
        if(dIndex < 0) dIndex += 7;
        weeklyLabels.push(daysOfWeek[dIndex]);
    }

    weeklySales.forEach(sale => {
        let jsDay = sale._id - 1; 
        let labelIndex = weeklyLabels.indexOf(daysOfWeek[jsDay]);
        if(labelIndex !== -1) {
            weeklyDataArray[labelIndex] = sale.revenue;
        }
    });

    const chartData = {
        monthly: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            data: monthlyDataArray
        },
        yearly: {
            labels: yearlyLabels.length ? yearlyLabels : [currentYear.toString()],
            data: yearlyDataArray.length ? yearlyDataArray : [0]
        },
        weekly: {
            labels: weeklyLabels,
            data: weeklyDataArray
        }
    };

    return {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalRevenue,
        totalUsers,
        activeUsers,
        blockedUsers,
        topProducts,
        topCategories,
        topBrands,
        chartData
    };
};

module.exports = {
    getDashboardStats
};