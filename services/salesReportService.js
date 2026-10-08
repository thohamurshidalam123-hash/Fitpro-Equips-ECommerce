const Order = require('../models/orderModel');

const getSalesReportData = async (period = 'weekly', customStartDate, customEndDate) => {
    let startDate, endDate;
    const now = new Date();
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
        case 'daily':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6); // Last 7 days including today
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'monthly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 29); // Last 30 days
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'yearly':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'custom':
            startDate = customStartDate ? new Date(customStartDate) : new Date(now);
            startDate.setHours(0, 0, 0, 0);
            endDate = customEndDate ? new Date(customEndDate) : new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            period = 'weekly';
    }

    // For count 'Delivered' orders as successful sales revenue
    const query = {
        orderStatus: 'Delivered',
        createdAt: { $gte: startDate,$lte: endDate }
    };

    const orders = await Order.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    let totalOrderAmount = 0;
    let totalDiscount = 0;
    let totalCouponDeductions = 0;

    const formattedOrders = orders.map(order => {
        const customerName = order.userId ? order.userId.name : (order.shippingAddress ? order.shippingAddress.name : 'Guest');
        
        totalOrderAmount += order.grandTotal || 0;
        
        // For calculating total discounts given
        const couponDiscount = order.discount || 0;
        const productOfferDiscount = order.productOfferDiscount || 0;
        totalDiscount += couponDiscount + productOfferDiscount;
        totalCouponDeductions += couponDiscount;

        return {
            orderId: order.orderId,
            customerName: customerName,
            grandTotal: order.grandTotal,
            discount: couponDiscount + productOfferDiscount,
            couponDiscount,
            productOfferDiscount,
            paymentMethod: order.paymentMethod,
            createdAt: order.createdAt
        };
    });

    // For setting up key performanace indicator
    const kpi = {
        totalOrders: orders.length,
        totalOrderAmount,
        totalDiscount,
        totalCouponDeductions
    };

    return {
        orders: formattedOrders,
        kpi,
        currentFilter: period,
        // For formatting dates as YYYY-MM-DD
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};

module.exports = {
    getSalesReportData
};